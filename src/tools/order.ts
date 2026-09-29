import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { maskSecrets } from "../client.js";
import { ok, fail, note } from "./helpers.js";

const deployPeriods = [
  "monthly",
  "quarterly",
  "semi-annually",
  "annually",
] as const;

/** Order and reinstall (eq/order_instance). */
export function registerOrderTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "order_server",
    {
      description:
        "Order an instant or stock server (eq/order_instance). IMPORTANT: ordering charges the credit balance " +
        "or creates an invoice. Defaults to dry_run=true — only checks preset/OS availability " +
        "and returns a summary without placing an order. For a real order pass dry_run=false and confirm=true " +
        "after explicit user consent on the cost. Deploy takes 10–30 minutes; status via check_task.",
      inputSchema: {
        preset: z
          .string()
          .describe(
            "Preset ID or name from list_presets (e.g. 108 or vm.pico)",
          ),
        location_name: z
          .string()
          .describe("Location: NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH"),
        os_id: z.number().int().describe("OS ID from list_os"),
        traffic_plan: z
          .number()
          .int()
          .describe("Traffic plan ID from list_traffic_plans"),
        root_pass: z
          .string()
          .min(8)
          .describe(
            "Root password: min. 8 chars, uppercase, digit, special char (not @ or #)",
          ),
        deploy_period: z.enum(deployPeriods).describe("Billing period"),
        soft_id: z
          .number()
          .int()
          .optional()
          .describe("Software ID from list_software (optional)"),
        hostname: z
          .string()
          .optional()
          .describe("Hostname; default is generated from location and ID"),
        ssh_key: z.string().optional().describe("Public SSH key for root"),
        deploy_notify: z
          .boolean()
          .optional()
          .describe(
            "Email notification when deploy finishes (recommended true)",
          ),
        post_install_script: z
          .string()
          .optional()
          .describe("Script run after deploy"),
        post_install_callback: z
          .string()
          .optional()
          .describe("Callback URL after deploy"),
        own_os: z
          .number()
          .int()
          .optional()
          .describe("1 — do not install OS (manual install)"),
        promocode: z.string().optional().describe("Discount promocode"),
        dry_run: z
          .boolean()
          .optional()
          .describe(
            "Default true: validate parameters without placing an order or charging",
          ),
        confirm: z
          .boolean()
          .optional()
          .describe("Required (=true) for a real order"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const {
        dry_run = true,
        confirm = false,
        preset,
        location_name,
        os_id,
        ...rest
      } = args;

      if (dry_run) {
        // dry_run: validate only, do not place an order
        try {
          const checks: Record<string, unknown> = {};
          const presetCheck = (await client.call("presets", "search", {
            name: String(preset),
            location: location_name,
            scope: "free",
          })) as unknown;
          checks.preset_availability = presetCheck;
          const osList = (await client.call(
            "os",
            "list",
            {},
            { auth: false },
          )) as unknown;
          checks.os_lookup = osList;
          return ok(
            "DRY-RUN: order NOT created, no charge applied.\n\n" +
              `Parameters: preset=${preset}, location=${location_name}, os_id=${os_id}, ` +
              `traffic_plan=${args.traffic_plan}, period=${args.deploy_period}.\n` +
              "Availability check results:\n" +
              JSON.stringify(maskSecrets(checks), null, 2) +
              "\n\nIf everything looks correct and the user agrees on the cost — call again with dry_run=false and confirm=true.",
          );
        } catch (e) {
          return fail(e);
        }
      }

      if (!confirm) {
        return note(
          "Order not created: a real order requires confirm=true after explicit user consent on the cost. " +
            "Prefer running with dry_run=true first.",
        );
      }

      try {
        const res = (await client.call("eq", "order_instance", {
          preset,
          location_name,
          os_id,
          ...rest,
        })) as Record<string, unknown>;
        const callback = res?.callback;
        return ok(
          JSON.stringify(maskSecrets(res), null, 2) +
            (typeof callback === "string"
              ? `\n\nOrder created. Deploy callback: ${callback}. Deploy takes 10–30 minutes; track with check_task.`
              : ""),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "reinstall_server",
    {
      description:
        "Reinstall OS on an existing server (simplified path via eq/order_instance with id). " +
        "DESTRUCTIVE: all disk data will be erased. Requires HOSTKEY_ALLOW_DESTRUCTIVE=1 in the server environment, " +
        "confirm=true, and re-entering the server's current hostname. Async: status via check_task.",
      inputSchema: {
        id: z.number().int().describe("Server ID"),
        hostname: z
          .string()
          .describe(
            "Current server hostname — confirms the correct server is selected",
          ),
        os_id: z
          .number()
          .int()
          .describe("New OS ID from list_os (0 + own_os=1 — no OS install)"),
        root_pass: z.string().min(8).describe("New root password"),
        soft_id: z.number().int().optional().describe("Software ID from list_software"),
        ssh_key: z.string().optional().describe("Public SSH key for root"),
        own_os: z.number().int().optional().describe("1 — do not install OS"),
        post_install_script: z.string().optional(),
        deploy_notify: z.boolean().optional(),
        confirm: z
          .boolean()
          .describe("Required (=true) to start reinstall"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      if (process.env.HOSTKEY_ALLOW_DESTRUCTIVE !== "1") {
        return note(
          "OS reinstall is disabled by config: set HOSTKEY_ALLOW_DESTRUCTIVE=1 in the MCP server environment " +
            "to allow destructive operations.",
        );
      }
      const { id, hostname, confirm, ...params } = args;
      if (!confirm) {
        return note(
          `Reinstall of server ${id} (${hostname}) was not started: confirm=true required. ` +
            "WARNING: all disk data on the server will be erased.",
        );
      }
      try {
        const res = (await client.call("eq", "order_instance", {
          id,
          hostname,
          ...params,
        })) as Record<string, unknown>;
        const callback = res?.callback;
        return ok(
          JSON.stringify(maskSecrets(res), null, 2) +
            (typeof callback === "string"
              ? `\n\nReinstall started. Callback: ${callback}. Track with check_task; ` +
                "do not start a second reinstall while one is running."
              : ""),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
