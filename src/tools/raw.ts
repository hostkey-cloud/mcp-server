import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail, note } from "./helpers.js";
import { maskSecrets } from "../client.js";

/** Actions that also need HOSTKEY_ALLOW_DESTRUCTIVE=1. */
const DANGEROUS_ACTIONS =
  /^(delete|remove|off|reboot|reinstall|create_pxe|clear_pxe|boot_dev|order_instance|request_cancellation|apply_credit|mass_pay|create_addfunds|restore_snapshot|remove_snapshot|port_off|block_ip|request_poff|request_reboot)/i;

/** Raw InvAPI call for endpoints without a typed tool. */
export function registerRawTool(server: McpServer, client: InvApiClient): void {
  server.registerTool(
    "call_api_raw",
    {
      description:
        "Universal direct InvAPI call by resource and action, for resources without typed tools " +
        "(e.g.: iso — ISO image library, s3 — S3 Object Storage, rhr — Remote Hands new version; " +
        "see action list in the docs: https://hostkey.com/documentation/apidocs/). " +
        "ALWAYS requires confirm=true; destructive/paid actions additionally require HOSTKEY_ALLOW_DESTRUCTIVE=1. " +
        "Prefer typed tools when they exist for the needed operation.",
      inputSchema: {
        resource: z
          .string()
          .describe(
            "InvAPI resource without .php, e.g.: iso, s3, rhr, eq, net, whmcs",
          ),
        action: z.string().describe("Resource action, e.g.: list"),
        params: z
          .record(z.any())
          .optional()
          .describe(
            "Call parameters as an object; nested objects become params[...]",
          ),
        auth: z
          .boolean()
          .optional()
          .describe("Inject session token (defaults to true)"),
        confirm: z
          .boolean()
          .describe(
            "Required confirmation. Without confirm=true the call is rejected.",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async ({ resource, action, params = {}, auth, confirm }) => {
      if (confirm !== true) {
        return note(
          "Call not executed: call_api_raw always requires confirm=true.",
        );
      }
      if (
        DANGEROUS_ACTIONS.test(action) &&
        process.env.HOSTKEY_ALLOW_DESTRUCTIVE !== "1"
      ) {
        return note(
          `Action "${action}" looks destructive or paid and was rejected: ` +
            "set HOSTKEY_ALLOW_DESTRUCTIVE=1 in the MCP server environment to allow such calls.",
        );
      }
      try {
        const res = await client.call(resource, action, params, { auth });
        const callback = (res as Record<string, unknown> | null)?.callback;
        const suffix =
          typeof callback === "string"
            ? `\n\nAsync operation. Callback key: ${callback}. Track with check_task.`
            : "";
        return ok(JSON.stringify(maskSecrets(res), null, 2) + suffix);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
