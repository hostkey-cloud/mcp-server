import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const accountField = {
  account_id: z
    .number()
    .int()
    .optional()
    .describe("S3 account ID (if required; check via s3_get_users)"),
};

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

  registerRead(
    server,
    client,
    "s3_get_buckets",
    "List S3 account buckets and usage stats via AWS API (s3/get_buckets).",
    "s3",
    "get_buckets",
    accountField,
  );

  registerRead(
    server,
    client,
    "s3_get_buckets_via_queue",
    "List buckets, stats, and access keys via task queue (s3/get_buckets_rmq). May return a task key — then track status with check_task.",
    "s3",
    "get_buckets_rmq",
    accountField,
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
      ...accountField,
    },
  );

  registerRead(
    server,
    client,
    "s3_get_users",
    "List S3 users with service, traffic, and storage usage info (s3/get_users). Full filtering is available to administrators.",
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
      ...accountField,
    },
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
      ...accountField,
    },
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
      ...accountField,
    },
    { destructive: true },
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
      ...accountField,
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "s3_delete_account",
    "Fully delete a user's S3 account (s3/delete_account). DESTRUCTIVE: all buckets and data will be deleted. Requires HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "s3",
    "delete_account",
    accountField,
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "s3_delete_payment_account",
    "Initiate S3 account deletion via service cancellation in billing (s3/delete_payment_account). DESTRUCTIVE: an end date will be set on the active service. Requires HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "s3",
    "delete_payment_account",
    accountField,
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "s3_cancel_account_deletion",
    "Cancel S3 service deletion initiated via billing and restore the account to active status (s3/cancel_payment_account_deletion).",
    "s3",
    "cancel_payment_account_deletion",
    accountField,
  );

  registerAction(
    server,
    client,
    "s3_update_traffic_info",
    "Update S3 account traffic information (s3/update_traffic_info). Available to administrators only.",
    "s3",
    "update_traffic_info",
    accountField,
  );
}
