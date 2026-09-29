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
        "Check async job status by callback key (eq_callback/check). " +
        "Many InvAPI operations (power on/off, order, reinstall, snapshots) return {" +
        '"result":"OK","callback":"<key>"' +
        "}. Pass that key here: " +
        'result="Not ready" — still running; result="OK" — finished (key then expires). ' +
        "Server deploy can take 10–30 minutes.",
      inputSchema: {
        key: z
          .string()
          .describe("Callback key from an async operation response"),
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
