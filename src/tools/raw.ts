import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail, note } from "./helpers.js";
import { maskSecrets } from "../client.js";

/** Actions that also need HOSTKEY_ALLOW_DESTRUCTIVE=1. */
const DANGEROUS_ACTIONS =
  /^(delete|remove|off|reboot|reinstall|create_pxe|clear_pxe|boot_dev|order_instance|request_cancellation|apply_credit|mass_pay|create_addfunds|restore_snapshot|remove_snapshot|port_off|block_ip|request_poff|request_reboot)/i;

/** Raw InvAPI call for endpoints without a typed tool. */
export function registerRawTool(server: McpServer, client: InvApiClient): void {
  server.registerTool(
    "call_api_raw",
    {
      description:
        "Универсальный прямой вызов InvAPI по ресурсу и action, для ресурсов без типизированных инструментов " +
        "(например: iso — библиотека ISO-образов, s3 — S3 Object Storage, rhr — Remote Hands новой версии; " +
        "список действий смотрите в документации: https://hostkey.com/documentation/apidocs/). " +
        "ВСЕГДА требует confirm=true; деструктивные/платные действия дополнительно требуют HOSTKEY_ALLOW_DESTRUCTIVE=1. " +
        "Предпочитайте типизированные инструменты, если они есть для нужной операции.",
      inputSchema: {
        resource: z
          .string()
          .describe(
            "Ресурс InvAPI без .php, например: iso, s3, rhr, eq, net, whmcs",
          ),
        action: z.string().describe("Действие ресурса, например: list"),
        params: z
          .record(z.any())
          .optional()
          .describe(
            "Параметры вызова объектом; вложенные объекты превращаются в params[...]",
          ),
        auth: z
          .boolean()
          .optional()
          .describe("Подставлять сессионный токен (по умолчанию true)"),
        confirm: z
          .boolean()
          .describe(
            "Обязательное подтверждение. Без confirm=true вызов отклоняется.",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async ({ resource, action, params = {}, auth, confirm }) => {
      if (confirm !== true) {
        return note(
          "Вызов не выполнен: call_api_raw всегда требует confirm=true.",
        );
      }
      if (
        DANGEROUS_ACTIONS.test(action) &&
        process.env.HOSTKEY_ALLOW_DESTRUCTIVE !== "1"
      ) {
        return note(
          `Действие «${action}» выглядит деструктивным или платным и отклонено: ` +
            "установите HOSTKEY_ALLOW_DESTRUCTIVE=1 в окружении MCP-сервера, чтобы разрешить такие вызовы.",
        );
      }
      try {
        const res = await client.call(resource, action, params, { auth });
        const callback = (res as Record<string, unknown> | null)?.callback;
        const suffix =
          typeof callback === "string"
            ? `\n\nОперация асинхронная. Callback-ключ: ${callback}. Отслеживайте статус инструментом check_task.`
            : "";
        return ok(JSON.stringify(maskSecrets(res), null, 2) + suffix);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
