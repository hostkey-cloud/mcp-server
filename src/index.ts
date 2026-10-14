/** Hostkey MCP server (.com / invapi.hostkey.com). Env: see .env.example. */
import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { InvApiClient } from "./client.js";
import { registerServerTools } from "./tools/servers.js";
import { registerCatalogTools } from "./tools/catalog.js";
import { registerAccountTools } from "./tools/account.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerVmTools } from "./tools/vm.js";
import { registerRemoteTools } from "./tools/remote.js";
import { registerPxeTools } from "./tools/pxe.js";
import { registerIsoTools } from "./tools/iso.js";
import { registerS3Tools } from "./tools/s3.js";
import { registerRhrTools } from "./tools/rhr.js";
import { registerBillingTools } from "./tools/billing.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerPowerTools } from "./tools/power.js";
import { registerOrderTools } from "./tools/order.js";
import { registerRawTool } from "./tools/raw.js";
import { registerPrompts } from "./prompts.js";

const SERVER_NAME = "hostkey-mcp-server";
const SERVER_VERSION = "1.0.3";
const HOSTED_MCP_URL = "https://mcp.hostkey.com/mcp";
const SERVER_DESCRIPTION =
  "MCP server for Hostkey .com portal (InvAPI invapi.hostkey.com): servers, power, ordering, reinstall, DNS, S3, billing";

function intEnv(name: string, fallback?: number): number | undefined {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    logLine("warn", `bad ${name}`, { value: raw });
    return fallback;
  }
  return value;
}

/** Structured JSON logs to stderr; never log full Bearer/API keys. */
function logLine(
  level: "info" | "warn" | "error",
  msg: string,
  fields: Record<string, unknown> = {},
): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      service: SERVER_NAME,
      version: SERVER_VERSION,
      msg,
      ...fields,
    }),
  );
}

function bearerFingerprint(authHeader: string | undefined): string | undefined {
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return undefined;
  const token = authHeader.slice(7).trim();
  if (!token) return undefined;
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

function createServer(apiKey: string): McpServer {
  const client = new InvApiClient({
    apiKey,
    tokenTtlSeconds: intEnv("HOSTKEY_TOKEN_TTL"),
    httpTimeoutSeconds: intEnv("HOSTKEY_HTTP_TIMEOUT"),
  });

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Hostkey InvAPI (.com). Write calls need confirm=true; destructive ones also need HOSTKEY_ALLOW_DESTRUCTIVE=1. " +
        "Async jobs return a callback — use check_task. Prefer typed tools; otherwise call_api_raw. " +
        "Prompts: order_server_prompt, reinstall_server_prompt, troubleshoot_server_prompt.",
    },
  );

  registerServerTools(server, client);
  registerCatalogTools(server, client);
  registerAccountTools(server, client);
  registerNetworkTools(server, client);
  registerDnsTools(server, client);
  registerVmTools(server, client);
  registerRemoteTools(server, client);
  registerPxeTools(server, client);
  registerIsoTools(server, client);
  registerS3Tools(server, client);
  registerRhrTools(server, client);
  registerBillingTools(server, client);
  registerTaskTools(server, client);
  registerPowerTools(server, client);
  registerOrderTools(server, client);
  registerRawTool(server, client);
  registerPrompts(server);

  return server;
}

/** Prefer Authorization: Bearer <InvAPI key>; fall back to HOSTKEY_API_KEY. */
function resolveApiKey(authHeader: string | undefined): string | undefined {
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const fromEnv = process.env.HOSTKEY_API_KEY?.trim();
  return fromEnv || undefined;
}

/**
 * Browser clients (Open WebUI etc.) need CORS. Comma-separated origins, or "*".
 * Default: Hostkey Open WebUI hosts. OPTIONS is answered before auth.
 */
function parseCorsOrigins(): Set<string> | "*" {
  const raw = process.env.HOSTKEY_CORS_ORIGINS?.trim();
  if (!raw) {
    return new Set([
      "https://ollama.hostkey.com",
      "https://ollama.hostkey.ru",
    ]);
  }
  if (raw === "*") return "*";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function applyCorsHeaders(
  req: { header(name: string): string | undefined },
  res: { setHeader(name: string, value: string): unknown },
  origins: Set<string> | "*",
): boolean {
  const origin = req.header("origin");
  if (!origin) return false;
  if (origins !== "*" && !origins.has(origin)) return false;

  if (origins === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.header("access-control-request-headers") ??
      "Authorization, Content-Type, Accept, Mcp-Session-Id",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
  return true;
}

function serverCard() {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION,
    remotes: [
      {
        type: "streamable-http",
        url: HOSTED_MCP_URL,
        headers: [
          {
            name: "Authorization",
            description:
              "Bearer <InvAPI API key> for the .com portal (invapi.hostkey.com)",
            isRequired: true,
            isSecret: true,
          },
        ],
      },
    ],
  };
}

async function startHttp(): Promise<void> {
  const port = Number(process.env.PORT ?? 8080);
  const host = process.env.HOST ?? "0.0.0.0";
  const corsOrigins = parseCorsOrigins();
  const app = createMcpExpressApp({ host });

  const windowMs = intEnv("HOSTKEY_RATE_LIMIT_WINDOW_MS", 60_000) ?? 60_000;
  const max = intEnv("HOSTKEY_RATE_LIMIT_MAX", 120) ?? 120;
  const mcpLimiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const fp = bearerFingerprint(req.header("authorization") ?? undefined);
      if (fp) return `bearer:${fp}`;
      return `ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
    },
    handler: (req, res) => {
      logLine("warn", "rate_limited", {
        path: req.path,
        bearer_fp: bearerFingerprint(req.header("authorization") ?? undefined),
        ip: req.ip,
      });
      res.status(429).json({
        error: "rate_limited",
        message: "Too many requests; retry later",
      });
    },
  });

  app.use((req, res, next) => {
    applyCorsHeaders(req, res, corsOrigins);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, version: SERVER_VERSION, name: SERVER_NAME });
  });

  app.get("/.well-known/mcp/server-card.json", (_req, res) => {
    res.status(200).json(serverCard());
  });

  // Smithery / scanners sometimes probe under /mcp as well.
  app.get("/mcp/server-card.json", (_req, res) => {
    res.status(200).json(serverCard());
  });

  app.use("/mcp", mcpLimiter);

  app.all("/mcp", async (req, res) => {
    const authHeader = req.header("authorization") ?? undefined;
    const apiKey = resolveApiKey(authHeader);
    if (!apiKey) {
      logLine("warn", "missing_api_key", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: "missing_api_key",
        message:
          "Provide Authorization: Bearer <HOSTKEY_API_KEY> or set HOSTKEY_API_KEY",
      });
      return;
    }

    const server = createServer(apiKey);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logLine("error", "mcp_handler_error", {
        error: err instanceof Error ? err.message : String(err),
        bearer_fp: bearerFingerprint(authHeader),
      });
      if (!res.headersSent) {
        res.status(500).json({ error: "internal_error" });
      }
    }
  });

  app.listen(port, host, () => {
    const corsLabel =
      corsOrigins === "*" ? "*" : [...corsOrigins].join(",") || "(none)";
    logLine("info", "ready_http", {
      host,
      port,
      cors: corsLabel,
      rate_limit_window_ms: windowMs,
      rate_limit_max: max,
    });
  });
}

async function startStdio(): Promise<void> {
  const apiKey = process.env.HOSTKEY_API_KEY ?? "";
  const server = createServer(apiKey);
  await server.connect(new StdioServerTransport());
  logLine("info", "ready_stdio");
}

if ((process.env.MODE ?? "stdio").toLowerCase() === "http") {
  await startHttp();
} else {
  await startStdio();
}
