import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("Server ID") };
const ipField = { ip: z.string().describe("IP address") };

/** Network: ports, graphs, IP blocks, PTR (net.php, ip.php). */
export function registerNetworkTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_network_status",
    "Server network interface status (net/get_status): port, switch, VLAN, speed, MAC, link status.",
    "net",
    "get_status",
    idField,
  );

  registerRead(
    server,
    client,
    "get_port_graphs",
    "Port utilization graphs for a period (net/show_cacti): day/month/year.",
    "net",
    "show_cacti",
    {
      ...idField,
      port: z.string().describe("Physical switch port"),
      graph: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe("1 — day, 2 — month, 3 — year"),
    },
  );

  registerRead(
    server,
    client,
    "get_ip_info",
    "Network interface information by IP address (ip/get_ip).",
    "ip",
    "get_ip",
    ipField,
  );

  registerRead(
    server,
    client,
    "get_ptr_record",
    "Current PTR record (reverse DNS) for an IP address (ip/get_ptr).",
    "ip",
    "get_ptr",
    { ...idField, ...ipField },
  );

  registerAction(
    server,
    client,
    "port_on",
    "Enable a server network port (net/port_on).",
    "net",
    "port_on",
    {
      ...idField,
      port: z.string().describe("Physical switch port from get_network_status"),
    },
  );

  registerAction(
    server,
    client,
    "port_off",
    "Disable a server network port (net/port_off). DESTRUCTIVE: the server will lose network connectivity on this interface.",
    "net",
    "port_off",
    {
      ...idField,
      port: z.string().describe("Physical switch port from get_network_status"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "block_ip",
    "Block an IP address on the server at the Hostkey network level (net/block_ip). Useful for abuse requests.",
    "net",
    "block_ip",
    {
      ...idField,
      ...ipField,
      description: z.string().describe("Block reason"),
      four_hours: z
        .boolean()
        .optional()
        .describe("true — block is automatically lifted after 4 hours"),
    },
    {
      map: ({ four_hours, ...rest }) => ({
        ...rest,
        ...(four_hours ? { four_hours: 1 } : {}),
      }),
    },
  );

  registerAction(
    server,
    client,
    "unblock_ip",
    "Unblock an IP address on the server (net/unblock_ip).",
    "net",
    "unblock_ip",
    { ...idField, ...ipField },
  );

  registerAction(
    server,
    client,
    "update_ptr_record",
    "Update the PTR record for an IP address (ip/update_ptr). Multiple records are passed separated by %0A.",
    "ip",
    "update_ptr",
    { ...idField, ...ipField, ptr: z.string().describe("New PTR value") },
  );

  registerAction(
    server,
    client,
    "set_main_ip",
    "Set the primary IP address of the server (ip/set_main) when there are multiple addresses.",
    "ip",
    "set_main",
    {
      ...idField,
      ...ipField,
      main: z.string().describe("IP address that will become primary"),
    },
  );
}
