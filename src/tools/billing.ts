import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { InvApiClient } from "../client.js";
import { registerRead, registerAction } from "./helpers.js";

/** Billing (whmcs.php). Paid ops and cancellations need confirm; some also need HOSTKEY_ALLOW_DESTRUCTIVE. */
export function registerBillingTools(
  server: McpServer,
  client: InvApiClient,
): void {
  registerRead(
    server,
    client,
    "get_billing_client",
    "Данные клиента из биллинга (whmcs/get_client): контакты, валюта, статус аккаунта.",
    "whmcs",
    "get_client",
  );

  registerRead(
    server,
    client,
    "get_invoices",
    "Полный список инвойсов аккаунта (whmcs/get_invoices).",
    "whmcs",
    "get_invoices",
  );

  registerRead(
    server,
    client,
    "get_invoice",
    "Данные конкретного инвойса для оплаты (whmcs/get_invoice).",
    "whmcs",
    "get_invoice",
    { invoice_id: z.number().int().describe("Номер инвойса") },
  );

  registerRead(
    server,
    client,
    "get_server_invoices",
    "Инвойсы, относящиеся к конкретному серверу (whmcs/get_related_invoices).",
    "whmcs",
    "get_related_invoices",
    { id: z.number().int().describe("ID сервера") },
  );

  registerRead(
    server,
    client,
    "get_server_billing_data",
    "Платёжная информация по аренде сервера (whmcs/get_billing_data).",
    "whmcs",
    "get_billing_data",
    { id: z.number().int().describe("ID сервера") },
  );

  registerRead(
    server,
    client,
    "get_transactions",
    "Список транзакций по аккаунту клиента (whmcs/transactions).",
    "whmcs",
    "transactions",
    {
      invoice_id: z.number().int().optional().describe("Фильтр по инвойсу"),
      transaction_id: z
        .number()
        .int()
        .optional()
        .describe("Конкретная транзакция"),
    },
  );

  registerRead(
    server,
    client,
    "get_credit_history",
    "Движение средств по лицевому счёту: начисления и списания кредитов (whmcs/getcredits).",
    "whmcs",
    "getcredits",
    { id: z.number().int().describe("ID сервера") },
  );

  registerRead(
    server,
    client,
    "get_payment_gateway",
    "Способы оплаты конкретного инвойса (whmcs/getpaymentgw).",
    "whmcs",
    "getpaymentgw",
    { invoice_id: z.number().int().describe("Номер инвойса") },
  );

  registerRead(
    server,
    client,
    "download_invoice",
    "Скачать инвойс в PDF (whmcs/download_invoice). Ответ обычно содержит PDF в Base64 — сохраните и декодируйте при необходимости.",
    "whmcs",
    "download_invoice",
    { invoice_id: z.number().int().describe("Номер инвойса") },
  );

  registerRead(
    server,
    client,
    "get_cancellation_requests",
    "Список активных заявок на отмену услуг (whmcs/get_cancellation_requests).",
    "whmcs",
    "get_cancellation_requests",
    { id: z.number().int().optional().describe("ID сервера (фильтр)") },
  );

  registerRead(
    server,
    client,
    "get_contacts",
    "Список дополнительных контактов аккаунта (whmcs/get_contacts).",
    "whmcs",
    "get_contacts",
  );

  registerAction(
    server,
    client,
    "update_billing_client",
    "Изменить данные клиента в биллинге (whmcs/update_client): ФИО, компания, адрес, email, телефон и т.д.",
    "whmcs",
    "update_client",
    {
      billing_firstname: z.string().optional(),
      billing_lastname: z.string().optional(),
      billing_companyname: z.string().optional(),
      billing_email: z.string().optional(),
      billing_address1: z.string().optional(),
      billing_address2: z.string().optional(),
      billing_city: z.string().optional(),
      billing_state: z.string().optional(),
      billing_postcode: z.string().optional(),
      billing_country: z.string().optional(),
      billing_phonenumber: z.string().optional(),
    },
  );

  registerAction(
    server,
    client,
    "reset_billing_password",
    "Сбросить пароль аккаунта биллинга (whmcs/reset_password): на указанный email придёт ссылка для сброса. Email должен совпадать с email аккаунта.",
    "whmcs",
    "reset_password",
    { email: z.string().describe("Email аккаунта") },
  );

  registerAction(
    server,
    client,
    "add_contact",
    "Добавить дополнительный контакт в аккаунт (whmcs/add_contact). ВНИМАНИЕ: контакт создаётся со случайным email — его нужно поменять в Invapi.",
    "whmcs",
    "add_contact",
  );

  registerAction(
    server,
    client,
    "update_contact",
    "Изменить дополнительный контакт (whmcs/update_contact): email, пароль, телефон. Указание телефона включает 2FA по SMS.",
    "whmcs",
    "update_contact",
    {
      contact_id: z.number().int().describe("ID контакта"),
      email: z.string().describe("Email контакта"),
      password2: z.string().optional().describe("Новый пароль контакта"),
      phonenumber: z
        .string()
        .optional()
        .describe("Телефон (включает 2FA по SMS)"),
    },
  );

  registerAction(
    server,
    client,
    "delete_contact",
    "Удалить дополнительный контакт аккаунта (whmcs/delete_contact). ДЕСТРУКТИВНО.",
    "whmcs",
    "delete_contact",
    { contact_id: z.number().int().describe("ID контакта") },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "generate_due_invoice",
    "Создать следующий инвойс для сервера (whmcs/generate_due_invoice).",
    "whmcs",
    "generate_due_invoice",
    { id: z.number().int().describe("ID сервера") },
  );

  registerAction(
    server,
    client,
    "create_addfunds_invoice",
    "Создать инвойс на пополнение кредитного баланса (whmcs/create_addfunds). ДЕНЬГИ: создаёт реальный инвойс на указанную сумму.",
    "whmcs",
    "create_addfunds",
    { amount: z.number().describe("Сумма пополнения в валюте аккаунта") },
  );

  registerAction(
    server,
    client,
    "apply_credit",
    "Оплатить инвойс полностью или частично с кредитного баланса (whmcs/apply_credit). ДЕНЬГИ: списывает средства со счёта.",
    "whmcs",
    "apply_credit",
    {
      invoice_id: z.number().int().describe("Номер инвойса"),
      amount: z.number().describe("Сумма оплаты в валюте аккаунта"),
    },
  );

  registerAction(
    server,
    client,
    "mass_pay",
    "Создать групповой инвойс для оплаты нескольких инвойсов разом (whmcs/mass_pay). ДЕНЬГИ.",
    "whmcs",
    "mass_pay",
    { invoices: z.array(z.number().int()).describe("Массив номеров инвойсов") },
  );

  registerAction(
    server,
    client,
    "request_cancellation",
    "Запросить отмену услуги (whmcs/request_cancellation). ДЕСТРУКТИВНО: cancellation_type=1 — немедленная отмена с частичным возвратом (если возможно), 0 — отмена в конце биллинг-периода. Требует HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "whmcs",
    "request_cancellation",
    {
      id: z.number().int().describe("ID сервера"),
      cancellation_type: z
        .union([z.literal(0), z.literal(1)])
        .describe(
          "1 — немедленно (частичный возврат при возможности), 0 — в конце биллинг-периода",
        ),
      terminate_reason_custom: z.string().optional().describe("Причина отмены"),
    },
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "delete_cancellation_request",
    "Отозвать заявку на отмену услуги (whmcs/delete_cancellation_request).",
    "whmcs",
    "delete_cancellation_request",
    { id: z.number().int().describe("ID сервера") },
  );
}
