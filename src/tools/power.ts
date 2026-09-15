import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail, note, type ToolResult } from "./helpers.js";

const idParam = { id: z.number().int().describe("ID сервера") };
const confirmParam = {
  confirm: z
    .boolean()
    .describe(
      "Обязательное подтверждение операции. Без confirm=true вызов отклоняется.",
    ),
};

async function guarded(
  confirm: boolean,
  what: string,
  run: () => Promise<unknown>,
): Promise<ToolResult> {
  if (!confirm) {
    return note(
      `Операция «${what}» не выполнена: требуется явное подтверждение. ` +
        `Если пользователь согласен, повторите вызов с confirm=true.`,
    );
  }
  try {
    const res = (await run()) as Record<string, unknown>;
    const callback = res?.callback;
    const suffix =
      typeof callback === "string"
        ? `\n\nОперация асинхронная. Callback-ключ: ${callback}. Проверяйте статус инструментом check_task.`
        : "";
    return ok(`${JSON.stringify(res, null, 2)}${suffix}`);
  } catch (e) {
    return fail(e);
  }
}

/** Power control (eq/on, eq/off, eq/reboot). Needs confirm. */
export function registerPowerTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "power_on",
    {
      description:
        "Включить сервер (eq/on). Асинхронная операция: в ответе будет callback-ключ для check_task.",
      inputSchema: { ...idParam, ...confirmParam },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, confirm }) =>
      guarded(confirm, `включение сервера ${id}`, () =>
        client.call("eq", "on", { id }),
      ),
  );

  server.registerTool(
    "power_off",
    {
      description:
        "Выключить сервер (eq/off). ДЕСТРУКТИВНО: прерывает работу всех сервисов на сервере. " +
        "Требует confirm=true. Асинхронная операция: в ответе будет callback-ключ для check_task.",
      inputSchema: { ...idParam, ...confirmParam },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, confirm }) =>
      guarded(confirm, `выключение сервера ${id}`, () =>
        client.call("eq", "off", { id }),
      ),
  );

  server.registerTool(
    "reboot_server",
    {
      description:
        "Перезагрузить сервер (eq/reboot). Прерывает работу сервисов на время перезагрузки. " +
        "Требует confirm=true. Асинхронная операция: в ответе будет callback-ключ для check_task.",
      inputSchema: { ...idParam, ...confirmParam },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, confirm }) =>
      guarded(confirm, `перезагрузка сервера ${id}`, () =>
        client.call("eq", "reboot", { id }),
      ),
  );
}
