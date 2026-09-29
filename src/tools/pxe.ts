import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("Server ID") };

/**
 * PXE OS reinstall (Foreman) when reinstall_server is not enough.
 * Flow: create_reinstall_task → create_pxe_config → boot pxe → reboot →
 * wait → boot disk → clear_pxe_config.
 * Needs HOSTKEY_ALLOW_DESTRUCTIVE=1 and confirm=true.
 */
export function registerPxeTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerAction(
    server,
    client,
    "create_reinstall_task",
    "PXE reinstall step 1: create an OS reinstall master key (eq/reinstall). Returns reinstall_key used by check_task to track install stages. DESTRUCTIVE: part of the process that wipes server disks.",
    "eq",
    "reinstall",
    idField,
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "create_pxe_config",
    "PXE reinstall step 2: create a PXE config for OS install (eq/create_pxe). DESTRUCTIVE.",
    "eq",
    "create_pxe",
    {
      ...idField,
      os_id: z.number().int().describe("OS ID from list_os"),
      root_pass: z
        .string()
        .min(8)
        .describe("Root password (min. 8 chars, uppercase letter, digit)"),
      hostname: z.string().describe("Hostname"),
      ssh_key: z.string().optional().describe("Public SSH key"),
      post_install_callback: z
        .string()
        .optional()
        .describe("Callback URL after install"),
      post_install_script: z
        .string()
        .optional()
        .describe("Post-install script"),
      reinstall_key: z
        .string()
        .optional()
        .describe("Master key from create_reinstall_task"),
    },
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "set_boot_device",
    "Set server boot order (eq/boot_dev): pxe — network boot (reinstall step 3), disk — boot from disk (step 6), cd — mounted ISO.",
    "eq",
    "boot_dev",
    {
      ...idField,
      media: z.enum(["pxe", "disk", "cd"]).describe("Boot device"),
    },
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "clear_pxe_config",
    "PXE reinstall step 7: remove the PXE config (eq/clear_pxe). REQUIRED after completion — otherwise an unexpected reinstall may occur on the next reboot.",
    "eq",
    "clear_pxe",
    { ...idField, hostname: z.string().describe("Server hostname") },
    { destructive: true, envGuard: true },
  );
}
