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
    "List all DNS zones on the account on Hostkey PowerDNS servers (pdns/list_zones).",
    "pdns",
    "list_zones",
  );

  registerRead(
    server,
    client,
    "get_dns_zone",
    "DNS zone contents: all records (A, AAAA, CNAME, MX, TXT, etc.) from the authoritative server (pdns/view_zone).",
    "pdns",
    "view_zone",
    { zone: z.string().describe("Zone name, e.g. example.com") },
  );

  registerRead(
    server,
    client,
    "list_dns_domains",
    "List all user domains from the domains table (pdns/list_domains).",
    "pdns",
    "list_domains",
  );

  registerRead(
    server,
    client,
    "list_dns_subdomains",
    "List subdomains by server ID (pdns/list_subdomains).",
    "pdns",
    "list_subdomains",
    { server_id: z.number().int().describe("Server ID") },
  );

  registerAction(
    server,
    client,
    "add_dns_domain",
    "Create a DNS zone and add a domain to the domains table (pdns/add_domain). Requires pdns/edit permission.",
    "pdns",
    "add_domain",
    { name: z.string().describe("Domain name, e.g. example.com") },
  );

  registerAction(
    server,
    client,
    "delete_dns_domain",
    "Delete a domain by ID: DNS zone, the domain itself, and all its subdomains (pdns/delete_domain). DESTRUCTIVE. Requires pdns/edit permission.",
    "pdns",
    "delete_domain",
    {
      server_id: z.number().int().describe("Server ID"),
      domain_id: z.number().int().describe("Domain ID from list_dns_domains"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_dns_subdomain",
    "Add a subdomain to the subdomains table (pdns/add_subdomain). Requires pdns/edit permission.",
    "pdns",
    "add_subdomain",
    {
      server_id: z.number().int().describe("Server ID"),
      domain_id: z.number().int().describe("Domain ID from list_dns_domains"),
      name: z.string().describe("Subdomain name"),
    },
  );

  registerAction(
    server,
    client,
    "edit_dns_subdomain",
    "Update a subdomain (pdns/edit_subdomain). Requires pdns/edit permission.",
    "pdns",
    "edit_subdomain",
    {
      id: z.number().int().describe("Subdomain ID"),
      server_id: z.number().int().optional().describe("Server ID"),
    },
  );

  registerAction(
    server,
    client,
    "delete_dns_subdomain",
    "Delete a subdomain from the subdomains table (pdns/delete_subdomain). DESTRUCTIVE. Requires pdns/edit permission.",
    "pdns",
    "delete_subdomain",
    {
      server_id: z.number().int().describe("Server ID"),
      id: z.number().int().describe("Subdomain ID"),
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_dns_zone",
    "Create a DNS zone on the authoritative PowerDNS server (pdns/add_zone). Requires pdns/edit permission.",
    "pdns",
    "add_zone",
    {
      name: z.string().describe("Zone name, e.g. example.com"),
      kind: z
        .enum(["Master", "Slave"])
        .optional()
        .describe("Zone type, defaults to Master"),
      rrsets: z
        .boolean()
        .optional()
        .describe("Use RRset instead of records (defaults to true)"),
      dnssec: z
        .boolean()
        .optional()
        .describe("Enable DNSSEC (defaults to false)"),
      masters: z
        .array(z.string())
        .optional()
        .describe("List of master servers (for Slave)"),
      dns: z
        .object({
          ttl: z.number().int().optional(),
          mname: z
            .string()
            .optional()
            .describe("Primary NS, e.g. ns1.hostkey.com"),
          rname: z
            .string()
            .optional()
            .describe("Admin email, e.g. admin.example.com"),
          serial: z
            .number()
            .int()
            .optional()
            .describe("Zone serial, recommended YYYYMMDD00"),
          refresh: z.number().int().optional(),
          retry: z.number().int().optional(),
          expire: z.number().int().optional(),
          minimum: z.number().int().optional(),
        })
        .optional()
        .describe(
          "SOA parameters for the zone; Hostkey defaults apply if omitted",
        ),
      nameservers: z
        .array(z.string())
        .optional()
        .describe(
          "NS servers for the zone, defaults to ns1.hostkey.com/ns2.hostkey.com",
        ),
    },
  );

  registerAction(
    server,
    client,
    "delete_dns_zone",
    "Delete a DNS zone by name along with all records and metadata (pdns/delete_zone). DESTRUCTIVE. Requires pdns/edit permission.",
    "pdns",
    "delete_zone",
    { zone: z.string().describe("Zone name") },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "add_dns_record",
    "Add or update a DNS record in a zone (pdns/add_dns). Requires pdns/edit permission. " +
      "For SRV records, fill in proto/priority/weight/port/target. Fields mname/rname are marked required for SOA checks in the docs — fill them in on error.",
    "pdns",
    "add_dns",
    {
      zone: z.string().describe("Zone name"),
      name: z.string().optional().describe("Record name, e.g. www"),
      type: z.string().describe("Record type: A, AAAA, CNAME, MX, TXT, SRV…"),
      content: z.string().describe("Record value, e.g. 10.56.121.5"),
      ttl: z
        .number()
        .int()
        .optional()
        .describe("TTL in seconds, defaults to 3600"),
      old_name: z
        .string()
        .optional()
        .describe("Previous record name — for renaming"),
      increase_soa_serial: z
        .boolean()
        .optional()
        .describe("Auto-increment SOA serial (defaults to true)"),
      mname: z.string().optional().describe("Primary NS in the SOA record"),
      rname: z
        .string()
        .optional()
        .describe("Admin email in the SOA record"),
      proto: z.string().optional().describe("Protocol for SRV, e.g. tcp"),
      priority: z.number().int().optional().describe("Priority for SRV/MX"),
      weight: z.number().int().optional().describe("Weight for SRV"),
      port: z.number().int().optional().describe("Port for SRV"),
      target: z.string().optional().describe("Target domain for SRV"),
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
    "Delete a DNS record from a zone (pdns/delete_dns). DESTRUCTIVE. Requires pdns/edit permission.",
    "pdns",
    "delete_dns",
    {
      zone: z.string().describe("Zone name"),
      name: z.string().describe("Record name"),
      type: z.string().describe("Record type"),
    },
    { destructive: true },
  );
}
