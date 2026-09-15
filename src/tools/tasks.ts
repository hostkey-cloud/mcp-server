import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail } from "./helpers.js";

/** Async InvAPI jobs (callback keys). */
export function registerTaskTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "check_task",
    {
      description:
        "Проверка статуса асинхронной операции по callback-ключу (eq_callback/check). " +
        "Многие операции InvAPI (вкл/выкл питания, заказ, переустановка, снапшоты) возвращают {" +
        '"result":"OK","callback":"<ключ>"' +
        "}. Передайте этот ключ сюда, чтобы узнать статус: " +
        'result="Not ready" — операция ещё идёт; result="OK" — завершена успешно (после этого ключ сгорает). ' +
        "Деплой сервера может занимать 10–30 минут.",
      inputSchema: {
        key: z
          .string()
          .describe("Callback-ключ из ответа асинхронной операции"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ key }) => {
      try {
        return ok(await client.checkTask(key));
      } catch (e) {
        return fail(e);
      }
    },
  );
}
