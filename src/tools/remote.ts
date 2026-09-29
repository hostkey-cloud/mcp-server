import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("Server ID") };

/** IPMI/NAT, console, post-install tasks, Remote Hands (jira.php). */
export function registerRemoteTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_vnc_console",
    "Access the server VNC console (eq/console): returns console.vv config in Base64 for virt-viewer.",
    "eq",
    "console",
    idField,
  );

  registerRead(
    server,
    client,
    "start_novnc",
    "Start a NoVNC (HTML5) server console session (eq/novnc): returns a link to open in the browser.",
    "eq",
    "novnc",
    {
      ...idField,
      white_ip: z
        .string()
        .optional()
        .describe("IP allowed to connect from"),
    },
  );

  registerRead(
    server,
    client,
    "list_post_install_tasks",
    "Available post-install Ansible tasks (jenkins/get_tasks) with applicability tags: gpu, bm, vm, vgpu, default. Without a token — general list; with a token — tasks available to the specific user.",
    "jenkins",
    "get_tasks",
    {},
    { auth: false },
  );

  registerAction(
    server,
    client,
    "run_post_install_task",
    "Run a Jenkins/Ansible task on a server (jenkins/call): task ID or name from list_post_install_tasks + extra params. E.g. installing GPU drivers after OS reinstall.",
    "jenkins",
    "call",
    {
      ...idField,
      task: z
        .union([z.number().int(), z.string()])
        .describe("Task ID or name from list_post_install_tasks"),
      params: z
        .record(z.any())
        .optional()
        .describe("Additional task parameters"),
    },
  );

  registerAction(
    server,
    client,
    "add_static_nat",
    "Create a static DNAT to the server IPMI (nat/add_static_nat): public IP for IPMI access. Async operation. Track with check_task.",
    "nat",
    "add_static_nat",
    idField,
  );

  registerAction(
    server,
    client,
    "remove_static_nat",
    "Remove static DNAT to the server IPMI (nat/remove_static_nat).",
    "nat",
    "remove_static_nat",
    idField,
  );

  registerAction(
    server,
    client,
    "clear_static_nat",
    "Remove stale static NAT forwarding rules by internal IP (nat/clear_static_nat).",
    "nat",
    "clear_static_nat",
    { ip: z.string().describe("Internal IP address") },
  );

  registerAction(
    server,
    client,
    "drop_nat",
    "Delete a NAT record from the database (nat/drop_nat). DESTRUCTIVE, internal/ops action.",
    "nat",
    "drop_nat",
    {
      id: z.number().int().optional().describe("NAT record ID"),
      ip: z.string().optional().describe("Record IP address"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_ipmi_user",
    "Create a temporary IPMI user for web access to IPMI (eq/add_ipmi_user).",
    "eq",
    "add_ipmi_user",
    idField,
  );

  registerAction(
    server,
    client,
    "remove_ipmi_user",
    "Remove a temporary IPMI user (eq/remove_ipmi_user).",
    "eq",
    "remove_ipmi_user",
    idField,
  );

  registerAction(
    server,
    client,
    "reset_ipmi",
    "Reboot the server IPMI module (eq/unit_reset). Use when IPMI is unresponsive.",
    "eq",
    "unit_reset",
    idField,
  );

  // Remote Hands tickets (jira.php)
  const rhrNote =
    " Creates a Remote Hands ticket for the datacenter on-call shift; status and correspondence are in the ticket (link will be emailed).";

  registerAction(
    server,
    client,
    "request_rh_power_on",
    "Remote Hands request: power on the server manually (jira/request_pon)." +
      rhrNote,
    "jira",
    "request_pon",
    idField,
  );

  registerAction(
    server,
    client,
    "request_rh_power_off",
    "Remote Hands request: power off the server manually (jira/request_poff). DESTRUCTIVE for running services." +
      rhrNote,
    "jira",
    "request_poff",
    idField,
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "request_rh_reboot",
    "Remote Hands request: reboot the server manually (jira/request_reboot)." +
      rhrNote,
    "jira",
    "request_reboot",
    idField,
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "request_rh_pxe_boot",
    "Remote Hands request: boot the server via PXE (jira/request_PXEboot). Needed when reinstalling OS on servers without a remote management module." +
      rhrNote,
    "jira",
    "request_PXEboot",
    idField,
  );

  registerAction(
    server,
    client,
    "request_rh_kvm",
    "Remote Hands request: attach IP KVM to the server (jira/request_kvm)." +
      rhrNote,
    "jira",
    "request_kvm",
    idField,
  );

  registerAction(
    server,
    client,
    "request_rh_check",
    "Remote Hands request: check the server and boot it into the OS (jira/request_check)." +
      rhrNote,
    "jira",
    "request_check",
    idField,
  );

  registerAction(
    server,
    client,
    "request_sales_assistance",
    "Ticket to the sales department (jira/request_assistance): cancellation or transfer of a service and similar requests. Describe details in message.",
    "jira",
    "request_assistance",
    {
      id: z
        .number()
        .int()
        .optional()
        .describe("Server ID, if the request concerns a server"),
      subject: z.string().optional().describe("Request subject"),
      message: z
        .string()
        .describe("Request details: what to cancel/transfer and why"),
    },
  );
}
