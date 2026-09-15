import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const idField = { id: z.number().int().describe("ID сервера") };
const ipField = { ip: z.string().describe("IP-адрес") };

/** Network: ports, graphs, IP blocks, PTR (net.php, ip.php). */
export function registerNetworkTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_network_status",
    "Состояние сетевых интерфейсов сервера (net/get_status): порт, свитч, VLAN, скорость, MAC, статус подключения.",
    "net",
    "get_status",
    idField,
  );

  registerRead(
    server,
    client,
    "get_port_graphs",
    "Графики загрузки порта за период (net/show_cacti): день/месяц/год.",
    "net",
    "show_cacti",
    {
      ...idField,
      port: z.string().describe("Физический порт свитча"),
      graph: z
        .number()
        .int()
        .min(1)
        .max(3)
        .describe("1 — день, 2 — месяц, 3 — год"),
    },
  );

  registerRead(
    server,
    client,
    "get_ip_info",
    "Информация о сетевом интерфейсе по IP-адресу (ip/get_ip).",
    "ip",
    "get_ip",
    ipField,
  );

  registerRead(
    server,
    client,
    "get_ptr_record",
    "Текущая PTR-запись (reverse DNS) для IP-адреса (ip/get_ptr).",
    "ip",
    "get_ptr",
    { ...idField, ...ipField },
  );

  registerAction(
    server,
    client,
    "port_on",
    "Включить сетевой порт сервера (net/port_on).",
    "net",
    "port_on",
    {
      ...idField,
      port: z.string().describe("Физический порт свитча из get_network_status"),
    },
  );

  registerAction(
    server,
    client,
    "port_off",
    "Выключить сетевой порт сервера (net/port_off). ДЕСТРУКТИВНО: сервер потеряет сетевую связность по этому интерфейсу.",
    "net",
    "port_off",
    {
      ...idField,
      port: z.string().describe("Физический порт свитча из get_network_status"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "block_ip",
    "Заблокировать IP-адрес на сервере на уровне сети Hostkey (net/block_ip). Полезно для abuse-запросов.",
    "net",
    "block_ip",
    {
      ...idField,
      ...ipField,
      description: z.string().describe("Причина блокировки"),
      four_hours: z
        .boolean()
        .optional()
        .describe("true — блокировка автоматически снимется через 4 часа"),
    },
    {
      map: ({ four_hours, ...rest }) => ({
        ...rest,
        ...(four_hours ? { four_hours: 1 } : {}),
      }),
    },
  );

  registerAction(
    server,
    client,
    "unblock_ip",
    "Снять блокировку IP-адреса на сервере (net/unblock_ip).",
    "net",
    "unblock_ip",
    { ...idField, ...ipField },
  );

  registerAction(
    server,
    client,
    "update_ptr_record",
    "Обновить PTR-запись для IP-адреса (ip/update_ptr). Несколько записей передаются разделителем %0A.",
    "ip",
    "update_ptr",
    { ...idField, ...ipField, ptr: z.string().describe("Новое значение PTR") },
  );

  registerAction(
    server,
    client,
    "set_main_ip",
    "Назначить основной IP-адрес сервера (ip/set_main), когда адресов несколько.",
    "ip",
    "set_main",
    {
      ...idField,
      ...ipField,
      main: z.string().describe("IP-адрес, который станет основным"),
    },
  );
}
