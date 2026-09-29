import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

/** ISO images (iso.php). */
export function registerIsoTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "list_iso_images",
    "List available ISO images (iso/list_iso). For client keys, server_id is required — images are matched to the specific server.",
    "iso",
    "list_iso",
    {
      server_id: z
        .number()
        .int()
        .optional()
        .describe("Server ID (required for client keys)"),
    },
  );

  registerRead(
    server,
    client,
    "get_uploaded_isos",
    "List ISO images uploaded by the client (iso/uploaded).",
    "iso",
    "uploaded",
  );

  registerAction(
    server,
    client,
    "upload_iso",
    "Upload a new ISO image by URL (iso/upload). Available to clients.",
    "iso",
    "upload",
    {
      url: z.string().describe("Direct URL of the ISO image"),
      name: z.string().optional().describe("Image name in the library"),
    },
  );

  registerAction(
    server,
    client,
    "add_iso_image",
    "Add a new ISO image or update an existing one by name (iso/add). Requires special 'add' permission.",
    "iso",
    "add",
    {
      name: z.string().describe("Image name"),
      url: z.string().optional().describe("Image URL, if required"),
    },
  );

  registerAction(
    server,
    client,
    "mount_iso",
    "Mount an ISO image on a server (iso/mount_iso). Async operation. Callback key returned — track with check_task. " +
      "Take image ID/name from list_iso_images or get_uploaded_isos.",
    "iso",
    "mount_iso",
    {
      id: z.number().int().describe("Server ID"),
      iso_id: z
        .number()
        .int()
        .optional()
        .describe("Image ID from list_iso_images"),
      name: z
        .string()
        .optional()
        .describe("Image name (if identifying by name)"),
    },
  );

  registerAction(
    server,
    client,
    "unmount_iso",
    "Unmount an ISO image from a server (iso/unmount_iso). Async operation. Callback key returned — track with check_task.",
    "iso",
    "unmount_iso",
    { id: z.number().int().describe("Server ID") },
  );

  registerAction(
    server,
    client,
    "delete_iso_image",
    "Delete an ISO image by ID (iso/delete). DESTRUCTIVE. Per docs, available only to Hostkey staff — clients will likely get a permission error.",
    "iso",
    "delete",
    { id: z.number().int().describe("ISO image ID") },
    { destructive: true },
  );
}
