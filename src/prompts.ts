import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type PromptMessage = {
  role: "user";
  content: { type: "text"; text: string };
};

function userMessage(text: string): { messages: PromptMessage[] } {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

/** Multi-step prompts on top of the tools. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "order_server_prompt",
    {
      description:
        "Guided Hostkey server order: location → preset → OS → software → traffic plan → cost confirmation → order.",
      argsSchema: {
        location: z
          .string()
          .optional()
          .describe(
            "Desired location (NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH), if known",
          ),
        purpose: z
          .string()
          .optional()
          .describe(
            "Server purpose (website, GPU inference, DB…), if known",
          ),
      },
    },
    ({ location, purpose }) =>
      userMessage(
        [
          "Help order a Hostkey server, following these steps strictly:",
          "",
          `1. Location: ${location ? `user chose ${location}` : "ask the user for the desired location (NL/US/FI/DE/IS/TR/UK/ES/IT/PL/CH)"}.`,
          `2. Preset: ${purpose ? `purpose — ${purpose}. ` : ""}Call list_presets for the chosen location, suggest 2–3 suitable presets with prices (get_preset_pricing), and wait for the user to choose.`,
          "3. OS: call list_os for the chosen preset (instance_id) and suggest options; wait for os_id selection.",
          "4. Software: call list_software and suggest marketplace apps if relevant (soft_id is optional).",
          "5. Traffic: call list_traffic_plans and suggest a traffic plan (traffic_plan).",
          "6. Access: ask for a root password (min. 8 chars, uppercase, digit, special char, no @ or #) or a public SSH key, plus desired hostname and billing period (monthly/quarterly/semi-annually/annually).",
          "7. Always run order_server with dry_run=true and show the user a summary with estimated cost.",
          "8. Only after EXPLICIT user consent on the cost, call order_server again with dry_run=false and confirm=true.",
          "9. Keep the callback key from the response and tell the user deploy takes 10–30 minutes; offer to check status via check_task. Reminder: credentials arrive by email when deploy_notify=true.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "reinstall_server_prompt",
    {
      description:
        "Guided Hostkey OS reinstall with checks and progress tracking.",
      argsSchema: {
        server_id: z.string().optional().describe("Server ID, if known"),
      },
    },
    ({ server_id }) =>
      userMessage(
        [
          "Help reinstall the OS on a Hostkey server, following these steps strictly:",
          "",
          `1. ${server_id ? `Server ID: ${server_id}.` : "Determine the server ID: call get_servers and ask the user to pick one."}`,
          "2. Call get_server and get_power_status; show current state and hostname.",
          "3. EXPLICITLY warn the user: reinstall will erase ALL data on the disks. Wait for confirmation.",
          "4. Call list_os for this server, suggest OS options; wait for os_id. If the user wants software — list_software (soft_id).",
          "5. Collect parameters: new root password or SSH key, deploy_notify.",
          "6. Call reinstall_server with confirm=true and the server's current hostname. If the tool says destructive ops are disabled — explain how to set HOSTKEY_ALLOW_DESTRUCTIVE=1.",
          '7. Keep the callback key and track progress with check_task until result="OK". Do not start a second reinstall while one is running.',
          "8. After completion, remind: root password is new; email notification may not arrive with this method.",
        ].join("\n"),
      ),
  );

  server.registerPrompt(
    "troubleshoot_server_prompt",
    {
      description:
        "Diagnose Hostkey server issues: power, sensors, network — with recommendations.",
      argsSchema: {
        server_id: z.string().optional().describe("Server ID, if known"),
      },
    },
    ({ server_id }) =>
      userMessage(
        [
          "Help diagnose a Hostkey server problem, following these steps:",
          "",
          `1. ${server_id ? `Server ID: ${server_id}.` : "Determine the server ID via get_servers (filter by IP or tags: search_servers_by_tag)."}`,
          "2. Gather state: get_server (card), get_power_status (power), for bare-metal — get_server_sensors (temps/voltages).",
          "3. Analyze: server off → suggest power_on (with confirm=true, only with user consent). Sensor anomalies (overheat, PSU fault) → recommend support / Remote Hands via the InvAPI panel.",
          "4. Give a short summary: state, likely cause, recommended actions. Destructive actions (power_off, reboot_server, reinstall_server) — only after explicit user consent.",
        ].join("\n"),
      ),
  );
}
