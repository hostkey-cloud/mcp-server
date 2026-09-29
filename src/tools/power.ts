import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail, note, type ToolResult } from "./helpers.js";

const idParam = { id: z.number().int().describe("Server ID") };
const confirmParam = {
  confirm: z
    .boolean()
    .describe(
      "Required confirmation. Without confirm=true the call is rejected.",
    ),
};

async function guarded(
  confirm: boolean,
  what: string,
  run: () => Promise<unknown>,
): Promise<ToolResult> {
  if (!confirm) {
    return note(
      `Operation "${what}" was not run: explicit confirmation required. ` +
        `If the user agrees, call again with confirm=true.`,
    );
  }
  try {
    const res = (await run()) as Record<string, unknown>;
    const callback = res?.callback;
    const suffix =
      typeof callback === "string"
        ? `\n\nAsync job. Callback: ${callback}. Track with check_task.`
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
        "Power on a server (eq/on). Async: response includes a callback key for check_task.",
      inputSchema: { ...idParam, ...confirmParam },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ id, confirm }) =>
      guarded(confirm, `power on server ${id}`, () =>
        client.call("eq", "on", { id }),
      ),
  );

  server.registerTool(
    "power_off",
    {
      description:
        "Power off a server (eq/off). DESTRUCTIVE: interrupts all services on the server. " +
        "Requires confirm=true. Async: response includes a callback key for check_task.",
      inputSchema: { ...idParam, ...confirmParam },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, confirm }) =>
      guarded(confirm, `power off server ${id}`, () =>
        client.call("eq", "off", { id }),
      ),
  );

  server.registerTool(
    "reboot_server",
    {
      description:
        "Reboot a server (eq/reboot). Interrupts services during reboot. " +
        "Requires confirm=true. Async: response includes a callback key for check_task.",
      inputSchema: { ...idParam, ...confirmParam },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ id, confirm }) =>
      guarded(confirm, `reboot server ${id}`, () =>
        client.call("eq", "reboot", { id }),
      ),
  );
}
