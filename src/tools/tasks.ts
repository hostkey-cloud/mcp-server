import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { ok, fail } from "./helpers.js";

/** Best-effort MCP progress when the client sent progressToken. */
async function notifyProgress(
  extra: {
    _meta?: { progressToken?: string | number };
    sendNotification: (n: {
      method: "notifications/progress";
      params: {
        progressToken: string | number;
        progress: number;
        total?: number;
        message?: string;
      };
    }) => Promise<void>;
  },
  progress: number,
  total: number,
  message: string,
): Promise<void> {
  const token = extra._meta?.progressToken;
  if (token === undefined) return;
  try {
    await extra.sendNotification({
      method: "notifications/progress",
      params: { progressToken: token, progress, total, message },
    });
  } catch {
    // Client may not support progress; never fail the tool for that.
  }
}

/** Async InvAPI jobs (callback keys). */
export function registerTaskTools(
  server: McpServer,
  client: InvApiClient,
): void {
  server.registerTool(
    "check_task",
    {
      description:
        "Check async job status by callback key (eq_callback/check). " +
        "Many InvAPI operations (power on/off, order, reinstall, snapshots) return {" +
        '"result":"OK","callback":"<key>"' +
        "}. Pass that key here: " +
        'result="Not ready" — still running; result="OK" — finished (key then expires). ' +
        "Server deploy can take 10–30 minutes. " +
        "If the client sent progressToken, emits notifications/progress.",
      inputSchema: {
        key: z
          .string()
          .describe("Callback key from an async operation response"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ key }, extra) => {
      try {
        await notifyProgress(extra, 0, 1, "Checking InvAPI task status…");
        const res = await client.checkTask(key, extra.signal);
        const result =
          res && typeof res === "object"
            ? (res as Record<string, unknown>).result
            : undefined;
        const resultStr = result === undefined ? "" : String(result);
        const done = /^ok$/i.test(resultStr) || /^success$/i.test(resultStr);
        const pending = /not\s*ready/i.test(resultStr);
        await notifyProgress(
          extra,
          done ? 1 : pending ? 0.5 : 1,
          1,
          done
            ? "Task completed"
            : pending
              ? "Task still running (Not ready)"
              : `Task status: ${resultStr || "unknown"}`,
        );
        return ok(res);
      } catch (e) {
        return fail(e);
      }
    },
  );
}
