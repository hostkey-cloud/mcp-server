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
  "key",
  "root_pass",
  "password",
  "api_key",
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

interface CallOptions {
  /** Attach session token (default true). */
  auth?: boolean;
  /** Internal: avoid infinite relogin loops. */
  retried?: boolean;
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

  private async ensureToken(): Promise<string> {
    // Refresh a minute early so we don't hit expiry mid-request.
    if (this.token && Date.now() < this.tokenExpiresAtMs - 60_000)
      return this.token;

    const res = (await this.rawPost("auth", {
      action: "login",
      key: this.apiKey,
      ttl: this.tokenTtl,
      fix_ip: 0, // don't pin the token to one IP
    })) as Record<string, unknown>;

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
  ): Promise<unknown> {
    const url = `${this.baseUrl}/${resource}.php`;
    const body = new URLSearchParams();
    for (const [k, v] of flattenFields(fields)) body.append(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.httpTimeout * 1000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
    } catch (e) {
      const reason =
        e instanceof Error && e.name === "AbortError"
          ? `timeout ${this.httpTimeout}s`
          : String(e);
      throw new InvApiError(`InvAPI ${resource}: network error (${reason})`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
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
    if (auth) fields.token = await this.ensureToken();

    try {
      const res = await this.rawPost(resource, fields);
      if (
        res &&
        typeof res === "object" &&
        (res as Record<string, unknown>).result === -1
      ) {
        throw new InvApiError(
          `InvAPI ${resource}/${action}: ${String((res as Record<string, unknown>).error ?? "unknown error")}`,
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
  async checkTask(callbackKey: string): Promise<unknown> {
    return this.call(
      "eq_callback",
      "check",
      { key: callbackKey },
      { auth: false },
    );
  }
}
