/** HTTP client for Hostkey InvAPI. */

export interface InvApiClientOptions {
  /** InvAPI key (account-wide or per-server). */
  apiKey: string;
  /** Session token TTL in seconds (default 3600). */
  tokenTtlSeconds?: number;
  /** HTTP timeout in seconds (default 60). */
  httpTimeoutSeconds?: number;
}

export class InvApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly raw?: unknown,
  ) {
    super(message);
    this.name = "InvApiError";
  }
}

/** Hardcoded .com endpoint. Use hostkey-mcp-server-ru for .ru. */
const INVAPI_BASE_URL = "https://invapi.hostkey.com";
const DEFAULT_TOKEN_TTL = 3600;
const DEFAULT_HTTP_TIMEOUT = 60;

const SECRET_KEYS = new Set([
  "token",
  "key", // show_key payload; get_files also has key — prefer original_key there
  "root_pass",
  "password",
  "api_key",
  "access_key",
  "secret_key",
]);

/** Hide secrets in logged/returned payloads. */
export function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEYS.has(k.toLowerCase()) ? "***" : maskSecrets(v),
      ]),
    );
  }
  return value;
}

/** Flatten nested objects for InvAPI form-urlencoded fields. */
function flattenFields(
  fields: Record<string, unknown>,
): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const walk = (key: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(`${key}[]`, item);
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>))
        walk(`${key}[${k}]`, v);
      return;
    }
    pairs.push([key, String(value)]);
  };
  for (const [k, v] of Object.entries(fields)) walk(k, v);
  return pairs;
}

function looksLikePdf(buf: Buffer, contentType: string): boolean {
  if (contentType.includes("application/pdf")) return true;
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-")
    return true;
  return false;
}

interface CallOptions {
  /** Attach session token (default true). */
  auth?: boolean;
  /** Internal: avoid infinite relogin loops. */
  retried?: boolean;
  /** Optional abort from MCP request cancellation. */
  signal?: AbortSignal;
}

const NETWORK_RETRY_DELAYS_MS = [200, 500] as const;

/** Success / in-progress InvAPI result values that must not become MCP errors. */
const INVAPI_OK_RESULTS = new Set([
  "OK",
  "ok",
  "success",
  "Success",
  "Not ready", // eq_callback/check — job still running
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFetchCause(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  let cur: unknown = e.cause;
  let depth = 0;
  while (cur && depth < 3) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      const code = (cur as NodeJS.ErrnoException).code;
      if (code) parts.push(`code=${code}`);
      cur = cur.cause;
    } else {
      parts.push(String(cur));
      break;
    }
    depth += 1;
  }
  return parts.join(" | ");
}

/**
 * Return an error message if this InvAPI JSON body is a failure.
 * Only `result === -1` was historically treated as failure; InvAPI also returns
 * `result: "error"`, negative numbers (-3), and string "-1".
 */
export function invApiFailureMessage(res: unknown): string | null {
  if (!res || typeof res !== "object") return null;
  const body = res as Record<string, unknown>;
  const result = body.result;

  if (result === undefined || result === null) {
    if (body.error != null && body.error !== "") return String(body.error);
    if (typeof body.code === "number" && body.code < 0) {
      return String(body.message ?? body.error ?? `code ${body.code}`);
    }
    return null;
  }
  if (typeof result === "object") return null; // auth/login nested token
  if (typeof result === "string" && INVAPI_OK_RESULTS.has(result)) return null;

  if (result === "error" || result === "ERROR") {
    return String(body.message ?? body.error ?? "error");
  }
  if (typeof result === "number" && result < 0) {
    return String(body.error ?? body.message ?? `result ${result}`);
  }
  if (typeof result === "string" && /^-?\d+$/.test(result) && Number(result) < 0) {
    return String(body.error ?? body.message ?? `result ${result}`);
  }
  if (typeof body.code === "number" && body.code < 0) {
    return String(body.message ?? body.error ?? `code ${body.code}`);
  }
  return null;
}

export class InvApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly tokenTtl: number;
  private readonly httpTimeout: number;

  private token: string | null = null;
  private tokenExpiresAtMs = 0;
  private serversRefreshed = false;

  constructor(options: InvApiClientOptions) {
    if (!options.apiKey) {
      throw new InvApiError(
        "HOSTKEY_API_KEY is missing. Create a key in InvAPI and set it in the environment.",
      );
    }
    this.apiKey = options.apiKey;
    this.baseUrl = INVAPI_BASE_URL;
    this.tokenTtl = options.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL;
    this.httpTimeout = options.httpTimeoutSeconds ?? DEFAULT_HTTP_TIMEOUT;
  }

  private async ensureToken(signal?: AbortSignal): Promise<string> {
    // Refresh a minute early so we don't hit expiry mid-request.
    if (this.token && Date.now() < this.tokenExpiresAtMs - 60_000)
      return this.token;

    const res = (await this.rawPost(
      "auth",
      {
        action: "login",
        key: this.apiKey,
        ttl: this.tokenTtl,
        fix_ip: 0, // don't pin the token to one IP
      },
      signal,
    )) as Record<string, unknown>;

    // Token lives under result.token; flat token/scope is a fallback.
    const nested =
      res.result && typeof res.result === "object"
        ? (res.result as Record<string, unknown>)
        : null;
    const token = nested?.token ?? nested?.scope ?? res.token ?? res.scope;
    if (typeof token !== "string" || token.length === 0) {
      throw new InvApiError(
        "auth/login did not return a session token",
        undefined,
        maskSecrets(res),
      );
    }

    this.token = token;
    this.tokenExpiresAtMs = Date.now() + this.tokenTtl * 1000;
    this.serversRefreshed = false;
    return token;
  }

  private resetToken(): void {
    this.token = null;
    this.tokenExpiresAtMs = 0;
  }

  private async rawPost(
    resource: string,
    fields: Record<string, unknown>,
    outerSignal?: AbortSignal,
  ): Promise<unknown> {
    const url = `${this.baseUrl}/${resource}.php`;
    const body = new URLSearchParams();
    for (const [k, v] of flattenFields(fields)) body.append(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.httpTimeout * 1000);
    const onOuterAbort = () => controller.abort();
    if (outerSignal) {
      if (outerSignal.aborted) controller.abort();
      else outerSignal.addEventListener("abort", onOuterAbort, { once: true });
    }

    let res: Response | undefined;
    let lastNetworkError: unknown;
    const maxAttempts = 1 + NETWORK_RETRY_DELAYS_MS.length;
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
            signal: controller.signal,
          });
          lastNetworkError = undefined;
          break;
        } catch (e) {
          lastNetworkError = e;
          const isAbort = e instanceof Error && e.name === "AbortError";
          // Do not retry caller cancel or hard timeouts.
          if (isAbort || outerSignal?.aborted) break;
          if (attempt >= maxAttempts - 1) break;
          await sleep(NETWORK_RETRY_DELAYS_MS[attempt] ?? 500);
        }
      }
    } finally {
      clearTimeout(timer);
      outerSignal?.removeEventListener("abort", onOuterAbort);
    }

    if (!res) {
      const e = lastNetworkError;
      const reason =
        e instanceof Error && e.name === "AbortError"
          ? outerSignal?.aborted
            ? "cancelled"
            : `timeout ${this.httpTimeout}s`
          : formatFetchCause(e);
      throw new InvApiError(`InvAPI ${resource}: network error (${reason})`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

    // Binary PDF (e.g. whmcs/download_invoice) — HTTP 200 with %PDF body.
    if (res.ok && looksLikePdf(buf, contentType)) {
      return {
        result: "OK",
        content_type: "application/pdf",
        encoding: "base64",
        byte_length: buf.length,
        data: buf.toString("base64"),
        note: "PDF as base64. Decode and save as .pdf.",
      };
    }

    const text = buf.toString("utf8");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      if (res.ok) {
        // HTML/plain success bodies (misconfigured actions historically returned HTML).
        return {
          result: "OK",
          content_type: contentType || "text/plain",
          encoding: "text",
          data: text,
          note: "InvAPI returned a non-JSON body; raw text included.",
        };
      }
      throw new InvApiError(
        `InvAPI ${resource}: HTTP ${res.status}, non-JSON: ${text.slice(0, 300)}`,
        res.status,
      );
    }
    if (!res.ok) {
      const message =
        json && typeof json === "object" && "error" in json
          ? String((json as Record<string, unknown>).error)
          : text.slice(0, 300);
      throw new InvApiError(
        `InvAPI ${resource}: HTTP ${res.status}: ${message}`,
        res.status,
        maskSecrets(json),
      );
    }
    return json;
  }

  /** Call InvAPI. Relogins once on 401 / invalid token. */
  async call(
    resource: string,
    action: string,
    params: Record<string, unknown> = {},
    opts: CallOptions = {},
  ): Promise<unknown> {
    const auth = opts.auth ?? true;
    const fields: Record<string, unknown> = { action, ...params };
    if (auth) fields.token = await this.ensureToken(opts.signal);

    try {
      const res = await this.rawPost(resource, fields, opts.signal);
      const failure = invApiFailureMessage(res);
      if (failure != null) {
        throw new InvApiError(
          `InvAPI ${resource}/${action}: ${failure}`,
          undefined,
          maskSecrets(res),
        );
      }
      return res;
    } catch (e) {
      const isAuthFailure =
        e instanceof InvApiError &&
        (e.status === 401 ||
          /invalid token|token.*(invalid|expired)/i.test(e.message));
      if (auth && !opts.retried && isAuthFailure) {
        this.resetToken();
        return this.call(resource, action, params, { ...opts, retried: true });
      }
      throw e;
    }
  }

  /** Refresh inventory once per token before eq/list or eq/show. */
  async ensureServersRefreshed(): Promise<void> {
    if (this.serversRefreshed) return;
    await this.call("eq", "update_servers");
    this.serversRefreshed = true;
  }

  /** Check async job status by callback key (no auth). */
  async checkTask(callbackKey: string, signal?: AbortSignal): Promise<unknown> {
    return this.call(
      "eq_callback",
      "check",
      { key: callbackKey },
      { auth: false, signal },
    );
  }
}
