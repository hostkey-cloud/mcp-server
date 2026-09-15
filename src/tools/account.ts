import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail, registerRead, registerAction } from "./helpers.js";

/** Account info, logout, API keys. */
export function registerAccountTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_account_info",
    "Информация о текущем API-токене и аккаунте (auth/info): доступные вызовы, тип и роль аккаунта, ID привязанных серверов. Полезно для проверки подключения.",
    "auth",
    "info",
  );

  server.registerTool(
    "logout",
    {
      description:
        "Завершить текущую API-сессию (auth/logout): сессионный токен удаляется из InvAPI. При следующем вызове клиент автоматически выполнит повторный вход по API-ключу.",
      inputSchema: {},
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const res = await client.call("auth", "logout");
        return ok(res);
      } catch (e) {
        return fail(e);
      }
    },
  );

  registerRead(
    server,
    client,
    "list_api_keys",
    "Список всех API-ключей аккаунта (api_keys/list).",
    "api_keys",
    "list",
  );

  registerRead(
    server,
    client,
    "list_server_api_keys",
    "Список API-ключей, выданных для конкретного сервера (api_keys/list_for_server).",
    "api_keys",
    "list_for_server",
    { server_id: z.number().int().describe("ID сервера") },
    { map: ({ server_id }) => ({ params: { server_id } }) },
  );

  registerRead(
    server,
    client,
    "get_api_key",
    "Информация о конкретном API-ключе (api_keys/view).",
    "api_keys",
    "view",
    { id: z.number().int().describe("ID ключа из list_api_keys") },
    { map: ({ id }) => ({ params: { id } }) },
  );

  registerRead(
    server,
    client,
    "get_api_key_history",
    "История использования API-ключа за период (api_keys/history).",
    "api_keys",
    "history",
    {
      id: z.number().int().describe("ID ключа"),
      period_from: z.string().optional().describe("Начало периода, YYYY-MM-DD"),
      period_to: z.string().optional().describe("Конец периода, YYYY-MM-DD"),
    },
    { map: (args) => ({ params: args }) },
  );

  registerAction(
    server,
    client,
    "create_api_key",
    "Создать новый API-ключ для аккаунта или конкретного сервера (api_keys/add). Значение ключа будет показано один раз в ответе — сохраните его.",
    "api_keys",
    "add",
    {
      name: z.string().describe("Имя ключа"),
      server_id: z
        .number()
        .int()
        .optional()
        .describe("ID сервера; если не указан — ключ на весь аккаунт"),
      ip: z
        .string()
        .optional()
        .describe("Белый список IP, например 10.0.0.2, 10.4.6.3/24"),
      login_notify_method: z
        .enum(["none", "email", "webhook"])
        .describe(
          "Уведомления о входах по ключу; для per-server ключа используйте none",
        ),
      login_notify_address: z
        .string()
        .optional()
        .describe("Email или webhook URL для уведомлений"),
      active: z.boolean().describe("true — ключ активен"),
    },
    {
      map: ({ active, ...rest }) => ({
        params: { ...rest, active: active ? 1 : 0 },
      }),
    },
  );

  registerAction(
    server,
    client,
    "update_api_key",
    "Изменить параметры API-ключа (api_keys/edit): имя, IP-белый список, уведомления, активность.",
    "api_keys",
    "edit",
    {
      id: z.number().int().describe("ID ключа"),
      name: z.string().describe("Имя ключа"),
      ip: z.string().optional().describe("Белый список IP"),
      login_notify_method: z
        .enum(["none", "email", "webhook"])
        .describe("Способ уведомлений о входах"),
      login_notify_address: z.string().optional(),
      active: z.boolean().describe("true — ключ активен"),
    },
    {
      map: ({ active, ...rest }) => ({
        params: { ...rest, active: active ? 1 : 0 },
      }),
    },
  );

  registerAction(
    server,
    client,
    "delete_api_key",
    "Удалить API-ключ (api_keys/delete). ДЕСТРУКТИВНО: приложения, использующие ключ, потеряют доступ.",
    "api_keys",
    "delete",
    { id: z.number().int().describe("ID ключа") },
    { destructive: true, map: ({ id }) => ({ params: { id } }) },
  );
}
