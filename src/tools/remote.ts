import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("ID сервера") };

/** IPMI/NAT, console, post-install tasks, Remote Hands (jira.php). */
export function registerRemoteTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_vnc_console",
    "Доступ к VNC-консоли сервера (eq/console): возвращает конфиг console.vv в Base64 для virt-viewer.",
    "eq",
    "console",
    idField,
  );

  registerRead(
    server,
    client,
    "start_novnc",
    "Запустить NoVNC (HTML5) сессию консоли сервера (eq/novnc): возвращает ссылку для открытия в браузере.",
    "eq",
    "novnc",
    {
      ...idField,
      white_ip: z
        .string()
        .optional()
        .describe("IP, с которого разрешено подключение"),
    },
  );

  registerRead(
    server,
    client,
    "list_post_install_tasks",
    "Доступные post-install Ansible-задачи (jenkins/get_tasks) с тегами применимости: gpu, bm, vm, vgpu, default. Без токена — общий список, с токеном — доступные конкретному пользователю.",
    "jenkins",
    "get_tasks",
    {},
    { auth: false },
  );

  registerAction(
    server,
    client,
    "run_post_install_task",
    "Выполнить Jenkins/Ansible-задачу на сервере (jenkins/call): ID или имя задачи из list_post_install_tasks + доп. параметры. Например, установка GPU-драйверов после переустановки ОС.",
    "jenkins",
    "call",
    {
      ...idField,
      task: z
        .union([z.number().int(), z.string()])
        .describe("ID или имя задачи из list_post_install_tasks"),
      params: z
        .record(z.any())
        .optional()
        .describe("Дополнительные параметры задачи"),
    },
  );

  registerAction(
    server,
    client,
    "add_static_nat",
    "Создать статический DNAT до IPMI сервера (nat/add_static_nat): публичный IP для доступа к IPMI. Асинхронная операция — статус через check_task.",
    "nat",
    "add_static_nat",
    idField,
  );

  registerAction(
    server,
    client,
    "remove_static_nat",
    "Удалить статический DNAT до IPMI сервера (nat/remove_static_nat).",
    "nat",
    "remove_static_nat",
    idField,
  );

  registerAction(
    server,
    client,
    "clear_static_nat",
    "Удалить застывшие правила статического NAT-проброса по внутреннему IP (nat/clear_static_nat).",
    "nat",
    "clear_static_nat",
    { ip: z.string().describe("Внутренний IP-адрес") },
  );

  registerAction(
    server,
    client,
    "drop_nat",
    "Удалить запись о NAT из базы данных (nat/drop_nat). ДЕСТРУКТИВНО, служебная операция.",
    "nat",
    "drop_nat",
    {
      id: z.number().int().optional().describe("ID записи NAT"),
      ip: z.string().optional().describe("IP-адрес записи"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_ipmi_user",
    "Создать временного IPMI-пользователя для веб-доступа к IPMI (eq/add_ipmi_user).",
    "eq",
    "add_ipmi_user",
    idField,
  );

  registerAction(
    server,
    client,
    "remove_ipmi_user",
    "Удалить временного IPMI-пользователя (eq/remove_ipmi_user).",
    "eq",
    "remove_ipmi_user",
    idField,
  );

  registerAction(
    server,
    client,
    "reset_ipmi",
    "Перезагрузить IPMI-модуль сервера (eq/unit_reset). Применять, если IPMI не отвечает.",
    "eq",
    "unit_reset",
    idField,
  );

  // Remote Hands tickets (jira.php)
  const rhrNote =
    " Создаёт тикет Remote Hands для дежурной смены дата-центра; статус и переписка — в тикете (ссылка придёт на email).";

  registerAction(
    server,
    client,
    "request_rh_power_on",
    "Заявка Remote Hands: включить сервер вручную (jira/request_pon)." +
      rhrNote,
    "jira",
    "request_pon",
    idField,
  );

  registerAction(
    server,
    client,
    "request_rh_power_off",
    "Заявка Remote Hands: выключить сервер вручную (jira/request_poff). ДЕСТРУКТИВНО для работающих сервисов." +
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
    "Заявка Remote Hands: перезагрузить сервер вручную (jira/request_reboot)." +
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
    "Заявка Remote Hands: загрузить сервер по PXE (jira/request_PXEboot). Нужна при переустановке ОС на серверах без модуля удалённого управления." +
      rhrNote,
    "jira",
    "request_PXEboot",
    idField,
  );

  registerAction(
    server,
    client,
    "request_rh_kvm",
    "Заявка Remote Hands: подключить IP KVM к серверу (jira/request_kvm)." +
      rhrNote,
    "jira",
    "request_kvm",
    idField,
  );

  registerAction(
    server,
    client,
    "request_rh_check",
    "Заявка Remote Hands: проверить сервер и загрузить его в ОС (jira/request_check)." +
      rhrNote,
    "jira",
    "request_check",
    idField,
  );

  registerAction(
    server,
    client,
    "request_sales_assistance",
    "Тикет в отдел продаж (jira/request_assistance): отмена или перенос услуги и подобные запросы. Опишите детали в message.",
    "jira",
    "request_assistance",
    {
      id: z
        .number()
        .int()
        .optional()
        .describe("ID сервера, если запрос касается сервера"),
      subject: z.string().optional().describe("Тема запроса"),
      message: z
        .string()
        .describe("Детали запроса: что отменить/перенести и почему"),
    },
  );
}
