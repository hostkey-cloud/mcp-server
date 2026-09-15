import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("ID сервера") };

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
    "Шаг 1 PXE-переустановки: создать мастер-ключ переустановки ОС (eq/reinstall). Возвращает reinstall_key, по которому check_task отслеживает стадии установки. ДЕСТРУКТИВНО: часть процесса, затирающего диски сервера.",
    "eq",
    "reinstall",
    idField,
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "create_pxe_config",
    "Шаг 2 PXE-переустановки: создать PXE-конфиг для установки ОС (eq/create_pxe). ДЕСТРУКТИВНО.",
    "eq",
    "create_pxe",
    {
      ...idField,
      os_id: z.number().int().describe("ID ОС из list_os"),
      root_pass: z
        .string()
        .min(8)
        .describe("Пароль root (мин. 8 символов, заглавная буква, цифра)"),
      hostname: z.string().describe("Имя хоста"),
      ssh_key: z.string().optional().describe("Публичный SSH-ключ"),
      post_install_callback: z
        .string()
        .optional()
        .describe("URL callback после установки"),
      post_install_script: z
        .string()
        .optional()
        .describe("Скрипт после установки"),
      reinstall_key: z
        .string()
        .optional()
        .describe("Мастер-ключ из create_reinstall_task"),
    },
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "set_boot_device",
    "Установить порядок загрузки сервера (eq/boot_dev): pxe — сетевая загрузка (шаг 3 переустановки), disk — загрузка с диска (шаг 6), cd — смонтированный ISO.",
    "eq",
    "boot_dev",
    {
      ...idField,
      media: z.enum(["pxe", "disk", "cd"]).describe("Устройство загрузки"),
    },
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "clear_pxe_config",
    "Шаг 7 PXE-переустановки: удалить PXE-конфиг (eq/clear_pxe). ОБЯЗАТЕЛЬНО после завершения — иначе возможна внезапная переустановка при следующей перезагрузке.",
    "eq",
    "clear_pxe",
    { ...idField, hostname: z.string().describe("Имя хоста сервера") },
    { destructive: true, envGuard: true },
  );
}
