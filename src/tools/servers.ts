import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail } from "./helpers.js";

/** Server list/details and tags (eq, tags). */
export function registerServerTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "get_servers",
    {
      description:
        "Список серверов аккаунта Hostkey с фильтрами. Перед первым вызовом автоматически обновляет инвентарь (eq/update_servers). Возвращает ID серверов и краткие данные; для полной карточки используйте get_server.",
      inputSchema: {
        location: z
          .string()
          .optional()
          .describe(
            "Коды локаций через запятую: NL,US,FI,DE,IS,TR,UK,ES,IT,PL,CH",
          ),
        status: z
          .string()
          .optional()
          .describe("Статус: rent (активный) или power_off (приостановлен)"),
        ip: z.string().optional().describe("Найти сервер по IP-адресу"),
        mac: z.string().optional().describe("Найти сервер по MAC-адресу"),
        group: z
          .string()
          .optional()
          .describe(
            "Группы через запятую: VPS,Gpu,1CPU,2CPU,AMD,Instances,Storage,Nodes,Micro,Mini,Dell",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        await client.ensureServersRefreshed();
        return ok(await client.call("eq", "list", args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_server",
    {
      description:
        "Полная информация о сервере по его ID (eq/show): конфигурация, сеть, статус, расположение.",
      inputSchema: {
        id: z.number().int().describe("ID сервера в InvAPI"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        await client.ensureServersRefreshed();
        return ok(await client.call("eq", "show", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_power_status",
    {
      description: "Текущий статус питания сервера (включён/выключен).",
      inputSchema: { id: z.number().int().describe("ID сервера") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("eq", "status", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_server_sensors",
    {
      description:
        "Показания аппаратных сенсоров сервера (температуры, напряжения, вентиляторы). Только для bare-metal.",
      inputSchema: { id: z.number().int().describe("ID сервера") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("eq", "sensors", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_server_tags",
    {
      description:
        "Все теги сервера (tags/list). Теги хранят произвольные пары ключ-значение.",
      inputSchema: { id: z.number().int().describe("ID сервера") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("tags", "list", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_servers_by_tag",
    {
      description:
        "Поиск серверов по имени или значению тега (tags/user_search). Возвращает ID серверов.",
      inputSchema: { value: z.string().describe("Шаблон поиска по тегам") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ value }) => {
      try {
        return ok(await client.call("tags", "user_search", { value }));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
