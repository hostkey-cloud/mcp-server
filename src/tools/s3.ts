import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

const accountField = {
  account_id: z
    .number()
    .int()
    .optional()
    .describe("ID S3-аккаунта (если требуется; уточняйте через s3_get_users)"),
};

/** S3 storage (s3.php). create_order is paid; some deletes need HOSTKEY_ALLOW_DESTRUCTIVE. */
export function registerS3Tools(server: McpServer, client: InvApiClient): void {
  registerRead(
    server,
    client,
    "s3_list_plans",
    "Список доступных тарифных планов S3-хранилища (s3/list_plans).",
    "s3",
    "list_plans",
    {
      location: z
        .string()
        .optional()
        .describe("Локация (фильтр), если поддерживается"),
    },
  );

  registerRead(
    server,
    client,
    "s3_get_locations",
    "Список доступных локаций для S3 (s3/get_available_locations).",
    "s3",
    "get_available_locations",
  );

  registerRead(
    server,
    client,
    "s3_get_buckets",
    "Список бакетов S3-аккаунта и статистика использования через AWS API (s3/get_buckets).",
    "s3",
    "get_buckets",
    accountField,
  );

  registerRead(
    server,
    client,
    "s3_get_buckets_via_queue",
    "Список бакетов, статистика и ключи доступа через очередь задач (s3/get_buckets_rmq). Может вернуть ключ задачи — тогда статус через check_task.",
    "s3",
    "get_buckets_rmq",
    accountField,
  );

  registerRead(
    server,
    client,
    "s3_get_files",
    "Список файлов в бакете с пагинацией и поиском (s3/get_files).",
    "s3",
    "get_files",
    {
      bucket: z.string().describe("Имя бакета"),
      page: z.number().int().optional().describe("Номер страницы"),
      limit: z.number().int().optional().describe("Размер страницы"),
      search: z.string().optional().describe("Поисковая строка по имени файла"),
      ...accountField,
    },
  );

  registerRead(
    server,
    client,
    "s3_get_users",
    "Список пользователей S3 с информацией о сервисе, трафике и использовании хранилища (s3/get_users). Полная фильтрация доступна администраторам.",
    "s3",
    "get_users",
    {
      location: z
        .string()
        .optional()
        .describe("Фильтр по локации (для администраторов)"),
    },
  );

  registerRead(
    server,
    client,
    "s3_show_key",
    "Получить расшифрованный ключ доступа S3 (s3/show_key). СЕКРЕТ: не логировать и не передавать третьим лицам.",
    "s3",
    "show_key",
    {
      key_type: z.enum(["access_key", "secret_key"]).describe("Тип ключа"),
      ...accountField,
    },
  );

  registerAction(
    server,
    client,
    "s3_create_account",
    "Создать S3-аккаунт: привязка тарифного плана и начального бакета (s3/create_account). Требует авторизации.",
    "s3",
    "create_account",
    {
      plan_id: z
        .union([z.number().int(), z.string()])
        .optional()
        .describe("ID тарифного плана из s3_list_plans"),
      location: z.string().optional().describe("Локация из s3_get_locations"),
      bucket: z.string().optional().describe("Имя начального бакета"),
    },
  );

  registerAction(
    server,
    client,
    "s3_create_bucket",
    "Создать новый бакет в существующем S3-аккаунте (s3/create_bucket).",
    "s3",
    "create_bucket",
    {
      bucket: z.string().describe("Имя бакета"),
      ...accountField,
    },
  );

  registerAction(
    server,
    client,
    "s3_create_order",
    "Создать платный заказ на S3-хранилище с привязкой к биллингу (s3/create_order). ДЕНЬГИ: создаёт реальный заказ/инвойс.",
    "s3",
    "create_order",
    {
      plan_id: z
        .union([z.number().int(), z.string()])
        .optional()
        .describe("ID тарифного плана"),
      location: z.string().optional().describe("Локация"),
    },
  );

  registerAction(
    server,
    client,
    "s3_delete_file",
    "Удалить файл из бакета (s3/delete_file). ДЕСТРУКТИВНО: файл удаляется безвозвратно.",
    "s3",
    "delete_file",
    {
      bucket: z.string().describe("Имя бакета"),
      file: z.string().describe("Ключ (имя) файла"),
      ...accountField,
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "s3_delete_bucket",
    "Удалить бакет из S3-аккаунта (s3/delete_bucket). ДЕСТРУКТИВНО: все файлы бакета будут удалены.",
    "s3",
    "delete_bucket",
    {
      bucket: z.string().describe("Имя бакета"),
      ...accountField,
    },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "s3_delete_account",
    "Полностью удалить S3-аккаунт пользователя (s3/delete_account). ДЕСТРУКТИВНО: все бакеты и данные будут удалены. Требует HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "s3",
    "delete_account",
    accountField,
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "s3_delete_payment_account",
    "Инициировать удаление S3-аккаунта через отмену сервиса в биллинге (s3/delete_payment_account). ДЕСТРУКТИВНО: активному сервису будет установлена дата завершения. Требует HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "s3",
    "delete_payment_account",
    accountField,
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "s3_cancel_account_deletion",
    "Отменить процесс удаления S3-сервиса, инициированный через биллинг, и восстановить активный статус аккаунта (s3/cancel_payment_account_deletion).",
    "s3",
    "cancel_payment_account_deletion",
    accountField,
  );

  registerAction(
    server,
    client,
    "s3_update_traffic_info",
    "Обновить информацию о трафике S3-аккаунта (s3/update_traffic_info). Доступно только администраторам.",
    "s3",
    "update_traffic_info",
    accountField,
  );
}
