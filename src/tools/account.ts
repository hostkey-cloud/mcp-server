import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail, registerRead, registerAction } from "./helpers.js";

/** Account info, logout, API keys. */
export function registerAccountTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_account_info",
    "Current API token and account info (auth/info): available calls, account type and role, linked server IDs. Useful to verify the connection.",
    "auth",
    "info",
  );

  server.registerTool(
    "logout",
    {
      description:
        "End the current API session (auth/logout): session token is removed from InvAPI. On the next call the client will sign in again with the API key.",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const res = await client.call("auth", "logout");
        return ok(res);
      } catch (e) {
        return fail(e);
      }
    },
  );

  registerRead(
    server,
    client,
    "list_api_keys",
    "List all account API keys (api_keys/list).",
    "api_keys",
    "list",
  );

  registerRead(
    server,
    client,
    "list_server_api_keys",
    "List API keys issued for a specific server (api_keys/list_for_server).",
    "api_keys",
    "list_for_server",
    { server_id: z.number().int().describe("Server ID") },
    { map: ({ server_id }) => ({ params: { server_id } }) },
  );

  registerRead(
    server,
    client,
    "get_api_key",
    "Details for a specific API key (api_keys/view).",
    "api_keys",
    "view",
    { id: z.number().int().describe("Key ID from list_api_keys") },
    { map: ({ id }) => ({ params: { id } }) },
  );

  registerRead(
    server,
    client,
    "get_api_key_history",
    "API key usage history for a period (api_keys/history).",
    "api_keys",
    "history",
    {
      id: z.number().int().describe("Key ID"),
      period_from: z.string().optional().describe("Period start, YYYY-MM-DD"),
      period_to: z.string().optional().describe("Period end, YYYY-MM-DD"),
    },
    { map: (args) => ({ params: args }) },
  );

  registerAction(
    server,
    client,
    "create_api_key",
    "Create a new API key for the account or a specific server (api_keys/add). The key value is shown once in the response — save it.",
    "api_keys",
    "add",
    {
      name: z.string().describe("Key name"),
      server_id: z
        .number()
        .int()
        .optional()
        .describe("Server ID; omit for an account-wide key"),
      ip: z
        .string()
        .optional()
        .describe("IP allowlist, e.g. 10.0.0.2, 10.4.6.3/24"),
      login_notify_method: z
        .enum(["none", "email", "webhook"])
        .describe(
          "Login notifications for this key; use none for per-server keys",
        ),
      login_notify_address: z
        .string()
        .optional()
        .describe("Email or webhook URL for notifications"),
      active: z.boolean().describe("true — key is active"),
    },
    {
      map: ({ active, ...rest }) => ({
        params: { ...rest, active: active ? 1 : 0 },
      }),
    },
  );

  registerAction(
    server,
    client,
    "update_api_key",
    "Update API key settings (api_keys/edit): name, IP allowlist, notifications, active flag.",
    "api_keys",
    "edit",
    {
      id: z.number().int().describe("Key ID"),
      name: z.string().describe("Key name"),
      ip: z.string().optional().describe("IP allowlist"),
      login_notify_method: z
        .enum(["none", "email", "webhook"])
        .describe("Login notification method"),
      login_notify_address: z.string().optional(),
      active: z.boolean().describe("true — key is active"),
    },
    {
      map: ({ active, ...rest }) => ({
        params: { ...rest, active: active ? 1 : 0 },
      }),
    },
  );

  registerAction(
    server,
    client,
    "delete_api_key",
    "Delete an API key (api_keys/delete). DESTRUCTIVE: apps using the key will lose access.",
    "api_keys",
    "delete",
    { id: z.number().int().describe("Key ID") },
    { destructive: true, map: ({ id }) => ({ params: { id } }) },
  );
}
