import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

/** InvAPI expects `s3uid` (string or numeric id from s3_get_users / create). */
const s3uidSchema = z
  .union([z.string(), z.number()])
  .describe(
    "S3 account UID (s3uid) from s3_get_users or create_account/order. Numeric id (e.g. 13457) or string uid.",
  );

const s3uidRequired = { s3uid: s3uidSchema };
const s3uidOptional = {
  s3uid: s3uidSchema.optional().describe(
    "S3 account UID; omit only if the token is bound to a single S3 account",
  ),
};

/** Compat: older clients sent account_id — map to s3uid. */
function mapS3Account(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  if (out.s3uid == null && out.account_id != null) {
    out.s3uid = out.account_id;
  }
  delete out.account_id;
  if (out.s3uid != null) out.s3uid = String(out.s3uid);
  return out;
}

/** S3 storage (s3.php). create_order is paid; some deletes need HOSTKEY_ALLOW_DESTRUCTIVE. */
export function registerS3Tools(server: McpServer, client: InvApiClient): void {
  registerRead(
    server,
    client,
    "s3_list_plans",
    "List available S3 storage plans (s3/list_plans).",
    "s3",
    "list_plans",
    {
      location: z
        .string()
        .optional()
        .describe("Location (filter), if supported"),
    },
  );

  registerRead(
    server,
    client,
    "s3_get_locations",
    "List available locations for S3 (s3/get_available_locations).",
    "s3",
    "get_available_locations",
  );

  // Live InvAPI returns "invalid command" for action=get_buckets; use get_buckets_rmq.
  registerRead(
    server,
    client,
    "s3_get_buckets",
    "List S3 account buckets and usage (s3/get_buckets_rmq). Pass s3uid from s3_get_users. May return a task key — then track with check_task. (Note: s3/get_buckets is not available on current InvAPI.)",
    "s3",
    "get_buckets_rmq",
    {
      ...s3uidRequired,
      account_id: z
        .number()
        .int()
        .optional()
        .describe("Deprecated alias for s3uid; prefer s3uid"),
    },
    { map: mapS3Account },
  );

  registerRead(
    server,
    client,
    "s3_get_buckets_via_queue",
    "Same as s3_get_buckets: list buckets via s3/get_buckets_rmq. Prefer s3_get_buckets.",
    "s3",
    "get_buckets_rmq",
    {
      ...s3uidRequired,
      account_id: z
        .number()
        .int()
        .optional()
        .describe("Deprecated alias for s3uid; prefer s3uid"),
    },
    { map: mapS3Account },
  );

  registerRead(
    server,
    client,
    "s3_get_files",
    "List files in a bucket with pagination and search (s3/get_files).",
    "s3",
    "get_files",
    {
      bucket: z.string().describe("Bucket name"),
      page: z.number().int().optional().describe("Page number"),
      limit: z.number().int().optional().describe("Page size"),
      search: z.string().optional().describe("Search string by file name"),
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { map: mapS3Account },
  );

  registerRead(
    server,
    client,
    "s3_get_users",
    "List S3 users with service, traffic, and storage usage info (s3/get_users). Full filtering is available to administrators. Use returned s3uid/id with s3_get_buckets.",
    "s3",
    "get_users",
    {
      location: z
        .string()
        .optional()
        .describe("Filter by location (for administrators)"),
    },
  );

  registerRead(
    server,
    client,
    "s3_show_key",
    "Get a decrypted S3 access key (s3/show_key). SECRET: do not log or share with third parties.",
    "s3",
    "show_key",
    {
      key_type: z.enum(["access_key", "secret_key"]).describe("Key type"),
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_create_account",
    "Create an S3 account: bind a plan and initial bucket (s3/create_account). Requires authentication.",
    "s3",
    "create_account",
    {
      plan_id: z
        .union([z.number().int(), z.string()])
        .optional()
        .describe("Plan ID from s3_list_plans"),
      location: z.string().optional().describe("Location from s3_get_locations"),
      bucket: z.string().optional().describe("Initial bucket name"),
    },
  );

  registerAction(
    server,
    client,
    "s3_create_bucket",
    "Create a new bucket in an existing S3 account (s3/create_bucket).",
    "s3",
    "create_bucket",
    {
      bucket: z.string().describe("Bucket name"),
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_create_order",
    "Create a paid S3 storage order linked to billing (s3/create_order). MONEY: creates a real order/invoice.",
    "s3",
    "create_order",
    {
      plan_id: z
        .union([z.number().int(), z.string()])
        .optional()
        .describe("Plan ID"),
      location: z.string().optional().describe("Location"),
    },
  );

  registerAction(
    server,
    client,
    "s3_delete_file",
    "Delete a file from a bucket (s3/delete_file). DESTRUCTIVE: the file is permanently deleted.",
    "s3",
    "delete_file",
    {
      bucket: z.string().describe("Bucket name"),
      file: z.string().describe("File key (name)"),
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { destructive: true, map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_delete_bucket",
    "Delete a bucket from an S3 account (s3/delete_bucket). DESTRUCTIVE: all files in the bucket will be deleted.",
    "s3",
    "delete_bucket",
    {
      bucket: z.string().describe("Bucket name"),
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { destructive: true, map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_delete_account",
    "Fully delete a user's S3 account (s3/delete_account). DESTRUCTIVE: all buckets and data will be deleted. Requires HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "s3",
    "delete_account",
    {
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { destructive: true, envGuard: true, map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_delete_payment_account",
    "Initiate S3 account deletion via service cancellation in billing (s3/delete_payment_account). DESTRUCTIVE: an end date will be set on the active service. Requires HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "s3",
    "delete_payment_account",
    {
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { destructive: true, envGuard: true, map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_cancel_account_deletion",
    "Cancel S3 service deletion initiated via billing and restore the account to active status (s3/cancel_payment_account_deletion).",
    "s3",
    "cancel_payment_account_deletion",
    {
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { map: mapS3Account },
  );

  registerAction(
    server,
    client,
    "s3_update_traffic_info",
    "Update S3 account traffic information (s3/update_traffic_info). Available to administrators only.",
    "s3",
    "update_traffic_info",
    {
      ...s3uidOptional,
      account_id: z.number().int().optional().describe("Deprecated alias for s3uid"),
    },
    { map: mapS3Account },
  );
}
