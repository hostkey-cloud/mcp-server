import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("ID виртуальной машины") };
const nameField = { name: z.string().describe("Имя снапшота") };

/** VM snapshots and stats (vm.php). */
export function registerVmTools(server: McpServer, client: InvApiClient): void {
  registerRead(
    server,
    client,
    "get_snapshots",
    "Список снапшотов виртуальной машины (vm/get_snapshot): имя, snapshot_id, дата.",
    "vm",
    "get_snapshot",
    idField,
  );

  registerRead(
    server,
    client,
    "get_vm_engine",
    "Информация о движке виртуализации (vm/get_engine).",
    "vm",
    "get_engine",
  );

  registerRead(
    server,
    client,
    "get_vm_stats",
    "Статистика виртуальной машины (vm/load_stats).",
    "vm",
    "load_stats",
    idField,
  );

  registerAction(
    server,
    client,
    "create_snapshot",
    "Создать снапшот виртуальной машины (vm/create_snapshot). Асинхронная операция — статус через check_task.",
    "vm",
    "create_snapshot",
    { ...idField, ...nameField },
  );

  registerAction(
    server,
    client,
    "remove_snapshot",
    "Удалить снапшот (vm/remove_snapshot). ДЕСТРУКТИВНО: снапшот удаляется безвозвратно. Удаление возможно только на выключенной ВМ.",
    "vm",
    "remove_snapshot",
    { ...idField, ...nameField },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "restore_snapshot",
    "Восстановить ВМ из снапшота (vm/restore_snapshot). ДЕСТРУКТИВНО: текущее состояние диска ВМ будет перезаписано состоянием снапшота.",
    "vm",
    "restore_snapshot",
    { ...idField, ...nameField },
    { destructive: true },
  );
}
