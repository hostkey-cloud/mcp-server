import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail } from "./helpers.js";

const locationParam = z
  .string()
  .describe("Location: NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH");

/** Catalog: presets, stock, OS, software, traffic plans. */
export function registerCatalogTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "list_presets",
    {
      description:
        "Current list of available instant servers (VM/BM/GPU/vGPU) with prices for a location. No token required. Use to pick a preset before ordering.",
      inputSchema: { location: locationParam },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ location }) => {
      try {
        return ok(
          await client.call("presets", "list", { location }, { auth: false }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_presets",
    {
      description:
        "Search free servers matching a preset name (e.g. vm.pico). Requires auth.",
      inputSchema: {
        name: z.string().describe("Preset name, e.g. vm.pico"),
        location: locationParam,
        scope: z
          .enum(["free", "all"])
          .optional()
          .describe("free (default) — available only"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(
          await client.call("presets", "search", {
            ...args,
            scope: args.scope ?? "free",
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_preset_pricing",
    {
      description:
        "Prices for available presets in given currencies (presets/info). No token required.",
      inputSchema: {
        currencies: z
          .string()
          .optional()
          .describe(
            "Currency codes, comma-separated, e.g. EUR,USD. Default EUR",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currencies }) => {
      try {
        return ok(
          await client.call(
            "presets",
            "info",
            { currencies: currencies ?? "EUR" },
            { auth: false },
          ),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_preset_groups",
    {
      description:
        "Preset groups for catalog categories (presets/groups). No token required.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        return ok(await client.call("presets", "groups", {}, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_preset",
    {
      description:
        "Details for one preset or all presets (presets/show). May require auth depending on permissions.",
      inputSchema: {
        id: z
          .number()
          .int()
          .optional()
          .describe("Preset ID; omit for full list"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("presets", "show", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_stock_servers",
    {
      description:
        "Available stock servers (physical servers of standard configs; deploy within a business day). No token required.",
      inputSchema: {
        location: locationParam,
        group: z
          .enum(["ALL", "1CPU", "2CPU", "GPU", "AMD", "AMD-MODERN", "INTEL"])
          .describe(
            "Server group; GPU servers are not included in other groups",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(await client.call("stocks", "list", args, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_stock_server",
    {
      description:
        "Details for a specific stock server (stocks/show).",
      inputSchema: {
        id: z.number().int().describe("Stock server ID from list_stock_servers"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("stocks", "show", { id }, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_os",
    {
      description:
        "Operating systems available for a preset/server (os/list). Without instance_id returns OS for all presets. No token required.",
      inputSchema: {
        instance_id: z
          .number()
          .int()
          .optional()
          .describe("Preset ID from list_presets"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ instance_id }) => {
      try {
        return ok(
          await client.call("os", "list", { instance_id }, { auth: false }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_software",
    {
      description:
        "Software (marketplace apps) available for auto-install (software/list). No token required.",
      inputSchema: {
        location: locationParam.optional(),
        instance_id: z
          .number()
          .int()
          .optional()
          .describe("Preset ID from list_presets"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(await client.call("software", "list", args, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_traffic_plans",
    {
      description:
        "Available traffic plans for a preset in a location (traffic_plans/list). No token required.",
      inputSchema: {
        location: locationParam,
        instance_id: z.number().int().describe("Preset ID from list_presets"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(
          await client.call("traffic_plans", "list", args, { auth: false }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
