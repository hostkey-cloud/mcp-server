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
    "Список заявок на удалённые работы с фильтрацией по локации и статусу (rhr/list).",
    "rhr",
    "list",
    {
      location: z
        .string()
        .optional()
        .describe("Фильтр по локации, например NL"),
      status: z.string().optional().describe("Фильтр по статусу заявки"),
    },
  );

  registerAction(
    server,
    client,
    "create_rhr_request",
    "Создать заявку на удалённые работы (rhr/add): работы дежурной смены в дата-центре, которые нельзя выполнить удалённо. " +
      "Опишите работы максимально подробно в comment. Использовать, только если модуль удалённого управления сервером недоступен/не работает.",
    "rhr",
    "add",
    {
      id: z.number().int().describe("ID сервера"),
      comment: z.string().describe("Подробное описание требуемых работ"),
      request_type: z
        .string()
        .optional()
        .describe("Тип работ, если задаётся справочником"),
    },
  );

  registerAction(
    server,
    client,
    "add_rhr_comment",
    "Добавить видимое клиенту сообщение в историю заявки (rhr/chat).",
    "rhr",
    "chat",
    {
      id: z.number().int().describe("ID заявки из list_rhr_requests"),
      message: z.string().describe("Текст сообщения"),
    },
  );

  registerAction(
    server,
    client,
    "discard_rhr_request",
    "Отменить/закрыть заявку на удалённые работы (rhr/discard). ДЕСТРУКТИВНО: заявка будет отменена.",
    "rhr",
    "discard",
    { id: z.number().int().describe("ID заявки") },
    { destructive: true },
  );
}
