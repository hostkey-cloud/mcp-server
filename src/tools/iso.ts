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
    "Список доступных ISO-образов (iso/list_iso). Для клиентских ключей обязателен server_id — образы подбираются под конкретный сервер.",
    "iso",
    "list_iso",
    {
      server_id: z
        .number()
        .int()
        .optional()
        .describe("ID сервера (обязателен для клиентских ключей)"),
    },
  );

  registerRead(
    server,
    client,
    "get_uploaded_isos",
    "Список ISO-образов, загруженных клиентом (iso/uploaded).",
    "iso",
    "uploaded",
  );

  registerAction(
    server,
    client,
    "upload_iso",
    "Загрузить новый ISO-образ по URL (iso/upload). Доступно клиентам.",
    "iso",
    "upload",
    {
      url: z.string().describe("Прямой URL ISO-образа"),
      name: z.string().optional().describe("Имя образа в библиотеке"),
    },
  );

  registerAction(
    server,
    client,
    "add_iso_image",
    "Добавить новый ISO-образ или обновить существующий по имени (iso/add). Требует специального права 'add'.",
    "iso",
    "add",
    {
      name: z.string().describe("Имя образа"),
      url: z.string().optional().describe("URL образа, если требуется"),
    },
  );

  registerAction(
    server,
    client,
    "mount_iso",
    "Смонтировать ISO-образ на сервер (iso/mount_iso). Асинхронная операция — вернётся callback-ключ для check_task. " +
      "ID/имя образа возьмите из list_iso_images или get_uploaded_isos.",
    "iso",
    "mount_iso",
    {
      id: z.number().int().describe("ID сервера"),
      iso_id: z
        .number()
        .int()
        .optional()
        .describe("ID образа из list_iso_images"),
      name: z
        .string()
        .optional()
        .describe("Имя образа (если используется идентификация по имени)"),
    },
  );

  registerAction(
    server,
    client,
    "unmount_iso",
    "Размонтировать ISO-образ с сервера (iso/unmount_iso). Асинхронная операция — вернётся callback-ключ для check_task.",
    "iso",
    "unmount_iso",
    { id: z.number().int().describe("ID сервера") },
  );

  registerAction(
    server,
    client,
    "delete_iso_image",
    "Удалить ISO-образ по ID (iso/delete). ДЕСТРУКТИВНО. По документации доступно только сотрудникам Hostkey — у клиентов, скорее всего, вернёт ошибку прав.",
    "iso",
    "delete",
    { id: z.number().int().describe("ID ISO-образа") },
    { destructive: true },
  );
}
