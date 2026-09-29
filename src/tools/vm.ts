import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("Virtual machine ID") };
const nameField = { name: z.string().describe("Snapshot name") };

/** VM snapshots and stats (vm.php). */
export function registerVmTools(server: McpServer, client: InvApiClient): void {
  registerRead(
    server,
    client,
    "get_snapshots",
    "List virtual machine snapshots (vm/get_snapshot): name, snapshot_id, date.",
    "vm",
    "get_snapshot",
    idField,
  );

  registerRead(
    server,
    client,
    "get_vm_engine",
    "Virtualization engine information (vm/get_engine).",
    "vm",
    "get_engine",
  );

  registerRead(
    server,
    client,
    "get_vm_stats",
    "Virtual machine statistics (vm/load_stats).",
    "vm",
    "load_stats",
    idField,
  );

  registerAction(
    server,
    client,
    "create_snapshot",
    "Create a virtual machine snapshot (vm/create_snapshot). Async operation. Track with check_task.",
    "vm",
    "create_snapshot",
    { ...idField, ...nameField },
  );

  registerAction(
    server,
    client,
    "remove_snapshot",
    "Delete a snapshot (vm/remove_snapshot). DESTRUCTIVE: the snapshot is permanently deleted. Deletion is only possible on a powered-off VM.",
    "vm",
    "remove_snapshot",
    { ...idField, ...nameField },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "restore_snapshot",
    "Restore a VM from a snapshot (vm/restore_snapshot). DESTRUCTIVE: the current VM disk state will be overwritten with the snapshot state.",
    "vm",
    "restore_snapshot",
    { ...idField, ...nameField },
    { destructive: true },
  );
}
