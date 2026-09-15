import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail } from "./helpers.js";

const locationParam = z
  .string()
  .describe("Локация: NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH");

/** Catalog: presets, stock, OS, software, traffic plans. */
export function registerCatalogTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "list_presets",
    {
      description:
        "Актуальный список доступных instant-серверов (VM/BM/GPU/vGPU) с ценами в указанной локации. Токен не требуется. Нужен для подбора preset перед заказом.",
      inputSchema: { location: locationParam },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ location }) => {
      try {
        return ok(
          await client.call("presets", "list", { location }, { auth: false }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_presets",
    {
      description:
        "Поиск подходящих свободных серверов под конкретный пресет по имени (например, vm.pico). Требует авторизации.",
      inputSchema: {
        name: z.string().describe("Имя пресета, например vm.pico"),
        location: locationParam,
        scope: z
          .enum(["free", "all"])
          .optional()
          .describe("free (по умолчанию) — только свободные"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(
          await client.call("presets", "search", {
            ...args,
            scope: args.scope ?? "free",
          }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_preset_pricing",
    {
      description:
        "Цены на доступные пресеты в указанных валютах (presets/info). Токен не требуется.",
      inputSchema: {
        currencies: z
          .string()
          .optional()
          .describe(
            "Коды валют через запятую, например EUR,USD. По умолчанию EUR",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ currencies }) => {
      try {
        return ok(
          await client.call(
            "presets",
            "info",
            { currencies: currencies ?? "EUR" },
            { auth: false },
          ),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_preset_groups",
    {
      description:
        "Список групп пресетов для категоризации каталога (presets/groups). Токен не требуется.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        return ok(await client.call("presets", "groups", {}, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_preset",
    {
      description:
        "Информация о конкретном пресете или обо всех пресетах (presets/show). Может требовать авторизации в зависимости от прав.",
      inputSchema: {
        id: z
          .number()
          .int()
          .optional()
          .describe("ID пресета; без него — список всех"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("presets", "show", { id }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_stock_servers",
    {
      description:
        "Список доступных stock-серверов (физические серверы стандартных конфигураций, деплой в течение рабочего дня). Токен не требуется.",
      inputSchema: {
        location: locationParam,
        group: z
          .enum(["ALL", "1CPU", "2CPU", "GPU", "AMD", "AMD-MODERN", "INTEL"])
          .describe(
            "Группа серверов; GPU-серверы не входят в остальные группы",
          ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(await client.call("stocks", "list", args, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_stock_server",
    {
      description:
        "Детальная информация о конкретном stock-сервере (stocks/show).",
      inputSchema: {
        id: z.number().int().describe("ID stock-сервера из list_stock_servers"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id }) => {
      try {
        return ok(await client.call("stocks", "show", { id }, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_os",
    {
      description:
        "Список операционных систем, доступных для установки на пресет/сервер (os/list). Без instance_id возвращает ОС для всех пресетов. Токен не требуется.",
      inputSchema: {
        instance_id: z
          .number()
          .int()
          .optional()
          .describe("ID пресета из list_presets"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ instance_id }) => {
      try {
        return ok(
          await client.call("os", "list", { instance_id }, { auth: false }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_software",
    {
      description:
        "Список ПО (marketplace-приложений), доступного для автоустановки на сервер (software/list). Токен не требуется.",
      inputSchema: {
        location: locationParam.optional(),
        instance_id: z
          .number()
          .int()
          .optional()
          .describe("ID пресета из list_presets"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(await client.call("software", "list", args, { auth: false }));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_traffic_plans",
    {
      description:
        "Доступные тарифные планы трафика для пресета в локации (traffic_plans/list). Токен не требуется.",
      inputSchema: {
        location: locationParam,
        instance_id: z.number().int().describe("ID пресета из list_presets"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      try {
        return ok(
          await client.call("traffic_plans", "list", args, { auth: false }),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
