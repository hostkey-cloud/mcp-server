/** Hostkey MCP server (.com / invapi.hostkey.com). Env: see .env.example. */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

function intEnv(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(
      `hostkey-mcp-server: bad ${name}="${raw}", using default`,
    );
    return undefined;
  }
  return value;
}

const client = new InvApiClient({
  apiKey: process.env.HOSTKEY_API_KEY ?? "",
  tokenTtlSeconds: intEnv("HOSTKEY_TOKEN_TTL"),
  httpTimeoutSeconds: intEnv("HOSTKEY_HTTP_TIMEOUT"),
});

const server = new McpServer(
  { name: "hostkey-mcp-server", version: "0.3.0" },
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

await server.connect(new StdioServerTransport());
console.error("hostkey-mcp-server: ready (stdio)");
