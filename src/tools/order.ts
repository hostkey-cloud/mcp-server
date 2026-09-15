import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { maskSecrets } from "../client.js";
import { ok, fail, note } from "./helpers.js";

const deployPeriods = [
  "monthly",
  "quarterly",
  "semi-annually",
  "annually",
] as const;

/** Order and reinstall (eq/order_instance). */
export function registerOrderTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "order_server",
    {
      description:
        "Заказ instant- или stock-сервера (eq/order_instance). ВАЖНО: заказ списывает средства с кредитного баланса " +
        "или выставляет инвойс. По умолчанию работает в режиме dry_run=true — только проверяет доступность пресета и ОС " +
        "и возвращает сводку без создания заказа. Для реального заказа передайте dry_run=false и confirm=true " +
        "после явного согласия пользователя на стоимость. Деплой занимает 10–30 минут, статус — через check_task.",
      inputSchema: {
        preset: z
          .string()
          .describe(
            "ID или имя пресета из list_presets (например, 108 или vm.pico)",
          ),
        location_name: z
          .string()
          .describe("Локация: NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH"),
        os_id: z.number().int().describe("ID ОС из list_os"),
        traffic_plan: z
          .number()
          .int()
          .describe("ID трафик-плана из list_traffic_plans"),
        root_pass: z
          .string()
          .min(8)
          .describe(
            "Пароль root: мин. 8 символов, заглавная буква, цифра, спецсимвол (кроме @ и #)",
          ),
        deploy_period: z.enum(deployPeriods).describe("Период оплаты"),
        soft_id: z
          .number()
          .int()
          .optional()
          .describe("ID ПО из list_software (опционально)"),
        hostname: z
          .string()
          .optional()
          .describe("Имя хоста; по умолчанию генерируется из локации и ID"),
        ssh_key: z.string().optional().describe("Публичный SSH-ключ для root"),
        deploy_notify: z
          .boolean()
          .optional()
          .describe(
            "Уведомление о завершении деплоя на email (рекомендуется true)",
          ),
        post_install_script: z
          .string()
          .optional()
          .describe("Скрипт, выполняемый после деплоя"),
        post_install_callback: z
          .string()
          .optional()
          .describe("URL callback после деплоя"),
        own_os: z
          .number()
          .int()
          .optional()
          .describe("1 — не устанавливать ОС (ручная установка)"),
        promocode: z.string().optional().describe("Промокод на скидку"),
        dry_run: z
          .boolean()
          .optional()
          .describe(
            "По умолчанию true: проверка параметров без создания заказа и списания средств",
          ),
        confirm: z
          .boolean()
          .optional()
          .describe("Обязателен (=true) для реального заказа"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const {
        dry_run = true,
        confirm = false,
        preset,
        location_name,
        os_id,
        ...rest
      } = args;

      if (dry_run) {
        // dry_run: validate only, do not place an order
        try {
          const checks: Record<string, unknown> = {};
          const presetCheck = (await client.call("presets", "search", {
            name: String(preset),
            location: location_name,
            scope: "free",
          })) as unknown;
          checks.preset_availability = presetCheck;
          const osList = (await client.call(
            "os",
            "list",
            {},
            { auth: false },
          )) as unknown;
          checks.os_lookup = osList;
          return ok(
            "DRY-RUN: заказ НЕ создан, средства не списаны.\n\n" +
              `Параметры: preset=${preset}, location=${location_name}, os_id=${os_id}, ` +
              `traffic_plan=${args.traffic_plan}, period=${args.deploy_period}.\n` +
              "Результаты проверки доступности:\n" +
              JSON.stringify(maskSecrets(checks), null, 2) +
              "\n\nЕсли всё корректно и пользователь согласен на стоимость — повторите вызов с dry_run=false и confirm=true.",
          );
        } catch (e) {
          return fail(e);
        }
      }

      if (!confirm) {
        return note(
          "Заказ не создан: для реального заказа требуется confirm=true после явного согласия пользователя на стоимость. " +
            "Рекомендуется сначала выполнить вызов с dry_run=true.",
        );
      }

      try {
        const res = (await client.call("eq", "order_instance", {
          preset,
          location_name,
          os_id,
          ...rest,
        })) as Record<string, unknown>;
        const callback = res?.callback;
        return ok(
          JSON.stringify(maskSecrets(res), null, 2) +
            (typeof callback === "string"
              ? `\n\nЗаказ создан. Callback-ключ деплоя: ${callback}. Деплой занимает 10–30 минут; проверяйте статус инструментом check_task.`
              : ""),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "reinstall_server",
    {
      description:
        "Переустановка ОС на существующем сервере (упрощённый путь через eq/order_instance с id). " +
        "ДЕСТРУКТИВНО: все данные на дисках будут удалены. Требуется HOSTKEY_ALLOW_DESTRUCTIVE=1 в окружении сервера, " +
        "confirm=true и повторный ввод текущего hostname сервера. Асинхронная операция: статус — через check_task.",
      inputSchema: {
        id: z.number().int().describe("ID сервера"),
        hostname: z
          .string()
          .describe(
            "Текущий hostname сервера — служит подтверждением, что сервер выбран верно",
          ),
        os_id: z
          .number()
          .int()
          .describe("ID новой ОС из list_os (0 + own_os=1 — без установки ОС)"),
        root_pass: z.string().min(8).describe("Новый пароль root"),
        soft_id: z.number().int().optional().describe("ID ПО из list_software"),
        ssh_key: z.string().optional().describe("Публичный SSH-ключ для root"),
        own_os: z.number().int().optional().describe("1 — не устанавливать ОС"),
        post_install_script: z.string().optional(),
        deploy_notify: z.boolean().optional(),
        confirm: z
          .boolean()
          .describe("Обязателен (=true) для запуска переустановки"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      if (process.env.HOSTKEY_ALLOW_DESTRUCTIVE !== "1") {
        return note(
          "Переустановка ОС отключена конфигурацией: установите HOSTKEY_ALLOW_DESTRUCTIVE=1 в окружении MCP-сервера, " +
            "чтобы разрешить деструктивные операции.",
        );
      }
      const { id, hostname, confirm, ...params } = args;
      if (!confirm) {
        return note(
          `Переустановка сервера ${id} (${hostname}) не запущена: требуется confirm=true. ` +
            "ВНИМАНИЕ: все данные на дисках сервера будут удалены.",
        );
      }
      try {
        const res = (await client.call("eq", "order_instance", {
          id,
          hostname,
          ...params,
        })) as Record<string, unknown>;
        const callback = res?.callback;
        return ok(
          JSON.stringify(maskSecrets(res), null, 2) +
            (typeof callback === "string"
              ? `\n\nПереустановка запущена. Callback-ключ: ${callback}. Отслеживайте через check_task; ` +
                "не запускайте вторую переустановку, пока идёт текущая."
              : ""),
        );
      } catch (e) {
        return fail(e);
      }
    },
  );
}
