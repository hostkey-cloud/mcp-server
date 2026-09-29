import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail } from "./helpers.js";

/** Server list/details and tags (eq, tags). */
export function registerServerTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "get_servers",
    {
      description:
        "List Hostkey account servers with filters. Before the first call, automatically refreshes inventory (eq/update_servers). Returns server IDs and brief data; use get_server for the full card.",
      inputSchema: {
        location: z
          .string()
          .optional()
          .describe(
            "Location codes, comma-separated: NL,US,FI,DE,IS,TR,UK,ES,IT,PL,CH",
          ),
        status: z
          .string()
          .optional()
          .describe("Status: rent (active) or power_off (suspended)"),
        ip: z.string().optional().describe("Find server by IP address"),
        mac: z.string().optional().describe("Find server by MAC address"),
        group: z
          .string()
          .optional()
          .describe(
            "Groups, comma-separated: VPS,Gpu,1CPU,2CPU,AMD,Instances,Storage,Nodes,Micro,Mini,Dell",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        await client.ensureServersRefreshed();
        return ok(await client.call("eq", "list", args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_server",
    {
      description:
        "Full server details by ID (eq/show): configuration, network, status, location.",
      inputSchema: {
        id: z.number().int().describe("Server ID in InvAPI"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        await client.ensureServersRefreshed();
        return ok(await client.call("eq", "show", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_power_status",
    {
      description: "Current server power status (on/off).",
      inputSchema: { id: z.number().int().describe("Server ID") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("eq", "status", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_server_sensors",
    {
      description:
        "Hardware sensor readings (temperatures, voltages, fans). Bare-metal only.",
      inputSchema: { id: z.number().int().describe("Server ID") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("eq", "sensors", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_server_tags",
    {
      description:
        "All server tags (tags/list). Tags store arbitrary key-value pairs.",
      inputSchema: { id: z.number().int().describe("Server ID") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("tags", "list", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_servers_by_tag",
    {
      description:
        "Search servers by tag name or value (tags/user_search). Returns server IDs.",
      inputSchema: { value: z.string().describe("Tag search pattern") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ value }) => {
      try {
        return ok(await client.call("tags", "user_search", { value }));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
