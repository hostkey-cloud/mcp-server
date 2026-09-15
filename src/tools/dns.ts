import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

/** DNS (pdns.php). Read needs pdns/view, write needs pdns/edit. */
export function registerDnsTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "list_dns_zones",
    "Список всех DNS-зон аккаунта на серверах PowerDNS Hostkey (pdns/list_zones).",
    "pdns",
    "list_zones",
  );

  registerRead(
    server,
    client,
    "get_dns_zone",
    "Содержимое DNS-зоны: все записи (A, AAAA, CNAME, MX, TXT и т.д.) с авторитетного сервера (pdns/view_zone).",
    "pdns",
    "view_zone",
    { zone: z.string().describe("Имя зоны, например example.com") },
  );

  registerRead(
    server,
    client,
    "list_dns_domains",
    "Список всех доменов пользователя из таблицы доменов (pdns/list_domains).",
    "pdns",
    "list_domains",
  );

  registerRead(
    server,
    client,
    "list_dns_subdomains",
    "Список сабдоменов по ID сервера (pdns/list_subdomains).",
    "pdns",
    "list_subdomains",
    { server_id: z.number().int().describe("ID сервера") },
  );

  registerAction(
    server,
    client,
    "add_dns_domain",
    "Создать DNS-зону и добавить домен в таблицу доменов (pdns/add_domain). Требует права pdns/edit.",
    "pdns",
    "add_domain",
    { name: z.string().describe("Имя домена, например example.com") },
  );

  registerAction(
    server,
    client,
    "delete_dns_domain",
    "Удалить домен по ID: DNS-зону, сам домен и все его сабдомены (pdns/delete_domain). ДЕСТРУКТИВНО. Требует права pdns/edit.",
    "pdns",
    "delete_domain",
    {
      server_id: z.number().int().describe("ID сервера"),
      domain_id: z.number().int().describe("ID домена из list_dns_domains"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_dns_subdomain",
    "Добавить сабдомен в таблицу сабдоменов (pdns/add_subdomain). Требует права pdns/edit.",
    "pdns",
    "add_subdomain",
    {
      server_id: z.number().int().describe("ID сервера"),
      domain_id: z.number().int().describe("ID домена из list_dns_domains"),
      name: z.string().describe("Имя сабдомена"),
    },
  );

  registerAction(
    server,
    client,
    "edit_dns_subdomain",
    "Обновить сабдомен (pdns/edit_subdomain). Требует права pdns/edit.",
    "pdns",
    "edit_subdomain",
    {
      id: z.number().int().describe("ID сабдомена"),
      server_id: z.number().int().optional().describe("ID сервера"),
    },
  );

  registerAction(
    server,
    client,
    "delete_dns_subdomain",
    "Удалить сабдомен из таблицы сабдоменов (pdns/delete_subdomain). ДЕСТРУКТИВНО. Требует права pdns/edit.",
    "pdns",
    "delete_subdomain",
    {
      server_id: z.number().int().describe("ID сервера"),
      id: z.number().int().describe("ID сабдомена"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_dns_zone",
    "Создать DNS-зону на авторитетном сервере PowerDNS (pdns/add_zone). Требует права pdns/edit.",
    "pdns",
    "add_zone",
    {
      name: z.string().describe("Имя зоны, например example.com"),
      kind: z
        .enum(["Master", "Slave"])
        .optional()
        .describe("Тип зоны, по умолчанию Master"),
      rrsets: z
        .boolean()
        .optional()
        .describe("Использовать RRset вместо records (по умолчанию true)"),
      dnssec: z
        .boolean()
        .optional()
        .describe("Включить DNSSEC (по умолчанию false)"),
      masters: z
        .array(z.string())
        .optional()
        .describe("Список master-серверов (для Slave)"),
      dns: z
        .object({
          ttl: z.number().int().optional(),
          mname: z
            .string()
            .optional()
            .describe("Primary NS, например ns1.hostkey.com"),
          rname: z
            .string()
            .optional()
            .describe("Email администратора, например admin.example.com"),
          serial: z
            .number()
            .int()
            .optional()
            .describe("Сериал зоны, рекомендуется YYYYMMDD00"),
          refresh: z.number().int().optional(),
          retry: z.number().int().optional(),
          expire: z.number().int().optional(),
          minimum: z.number().int().optional(),
        })
        .optional()
        .describe(
          "SOA-параметры зоны; при пропуске применяются дефолты Hostkey",
        ),
      nameservers: z
        .array(z.string())
        .optional()
        .describe(
          "NS-серверы зоны, по умолчанию ns1.hostkey.com/ns2.hostkey.com",
        ),
    },
  );

  registerAction(
    server,
    client,
    "delete_dns_zone",
    "Удалить DNS-зону по имени вместе со всеми записями и метаданными (pdns/delete_zone). ДЕСТРУКТИВНО. Требует права pdns/edit.",
    "pdns",
    "delete_zone",
    { zone: z.string().describe("Имя зоны") },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_dns_record",
    "Добавить или изменить DNS-запись в зоне (pdns/add_dns). Требует права pdns/edit. " +
      "Для SRV-записей заполните proto/priority/weight/port/target. Поля mname/rname в документации отмечены как обязательные для SOA-проверок — при ошибке заполните их.",
    "pdns",
    "add_dns",
    {
      zone: z.string().describe("Имя зоны"),
      name: z.string().optional().describe("Имя записи, например www"),
      type: z.string().describe("Тип записи: A, AAAA, CNAME, MX, TXT, SRV…"),
      content: z.string().describe("Значение записи, например 10.56.121.5"),
      ttl: z
        .number()
        .int()
        .optional()
        .describe("TTL в секундах, по умолчанию 3600"),
      old_name: z
        .string()
        .optional()
        .describe("Прежнее имя записи — для переименования"),
      increase_soa_serial: z
        .boolean()
        .optional()
        .describe("Автоинкремент SOA-сериала (по умолчанию true)"),
      mname: z.string().optional().describe("Primary NS в SOA-записи"),
      rname: z
        .string()
        .optional()
        .describe("Email администратора в SOA-записи"),
      proto: z.string().optional().describe("Протокол для SRV, например tcp"),
      priority: z.number().int().optional().describe("Приоритет для SRV/MX"),
      weight: z.number().int().optional().describe("Вес для SRV"),
      port: z.number().int().optional().describe("Порт для SRV"),
      target: z.string().optional().describe("Целевой домен для SRV"),
    },
    {
      map: ({ increase_soa_serial, ...rest }) => ({
        ...rest,
        ...(increase_soa_serial === undefined
          ? {}
          : { increase_soa_serial: increase_soa_serial ? 1 : 0 }),
      }),
    },
  );

  registerAction(
    server,
    client,
    "delete_dns_record",
    "Удалить DNS-запись из зоны (pdns/delete_dns). ДЕСТРУКТИВНО. Требует права pdns/edit.",
    "pdns",
    "delete_dns",
    {
      zone: z.string().describe("Имя зоны"),
      name: z.string().describe("Имя записи"),
      type: z.string().describe("Тип записи"),
    },
    { destructive: true },
  );
}
