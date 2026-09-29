import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

/** Remote Hands tickets (rhr.php). */
export function registerRhrTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "list_rhr_requests",
    "List Remote Hands requests with filtering by location and status (rhr/list).",
    "rhr",
    "list",
    {
      location: z
        .string()
        .optional()
        .describe("Filter by location, e.g. NL"),
      status: z.string().optional().describe("Filter by request status"),
    },
  );

  registerAction(
    server,
    client,
    "create_rhr_request",
    "Create a Remote Hands request (rhr/add): on-site datacenter shift work that cannot be done remotely. " +
      "Describe the work in as much detail as possible in comment. Use only if the remote server management module is unavailable/not working.",
    "rhr",
    "add",
    {
      id: z.number().int().describe("Server ID"),
      comment: z.string().describe("Detailed description of the required work"),
      request_type: z
        .string()
        .optional()
        .describe("Work type, if set by a directory"),
    },
  );

  registerAction(
    server,
    client,
    "add_rhr_comment",
    "Add a client-visible message to the request history (rhr/chat).",
    "rhr",
    "chat",
    {
      id: z.number().int().describe("Request ID from list_rhr_requests"),
      message: z.string().describe("Message text"),
    },
  );

  registerAction(
    server,
    client,
    "discard_rhr_request",
    "Cancel/close a Remote Hands request (rhr/discard). DESTRUCTIVE: the request will be cancelled.",
    "rhr",
    "discard",
    { id: z.number().int().describe("Request ID") },
    { destructive: true },
  );
}
