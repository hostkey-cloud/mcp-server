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
    "Client data from billing (whmcs/get_client): contacts, currency, account status.",
    "whmcs",
    "get_client",
  );

  registerRead(
    server,
    client,
    "get_invoices",
    "Full list of account invoices (whmcs/get_invoices).",
    "whmcs",
    "get_invoices",
  );

  registerRead(
    server,
    client,
    "get_invoice",
    "Data for a specific invoice for payment (whmcs/get_invoice).",
    "whmcs",
    "get_invoice",
    { invoice_id: z.number().int().describe("Invoice number") },
  );

  registerRead(
    server,
    client,
    "get_server_invoices",
    "Invoices related to a specific server (whmcs/get_related_invoices).",
    "whmcs",
    "get_related_invoices",
    { id: z.number().int().describe("Server ID") },
  );

  registerRead(
    server,
    client,
    "get_server_billing_data",
    "Billing information for a server rental (whmcs/get_billing_data).",
    "whmcs",
    "get_billing_data",
    { id: z.number().int().describe("Server ID") },
  );

  registerRead(
    server,
    client,
    "get_transactions",
    "List of transactions for the client account (whmcs/transactions).",
    "whmcs",
    "transactions",
    {
      invoice_id: z.number().int().optional().describe("Filter by invoice"),
      transaction_id: z
        .number()
        .int()
        .optional()
        .describe("Specific transaction"),
    },
  );

  registerRead(
    server,
    client,
    "get_credit_history",
    "Credit balance movement: credit additions and deductions (whmcs/getcredits).",
    "whmcs",
    "getcredits",
    { id: z.number().int().describe("Server ID") },
  );

  registerRead(
    server,
    client,
    "get_payment_gateway",
    "Payment methods for a specific invoice (whmcs/getpaymentgw).",
    "whmcs",
    "getpaymentgw",
    { invoice_id: z.number().int().describe("Invoice number") },
  );

  registerRead(
    server,
    client,
    "download_invoice",
    "Download an invoice as PDF (whmcs/download_invoice). Response usually contains PDF in Base64 — save and decode as needed.",
    "whmcs",
    "download_invoice",
    { invoice_id: z.number().int().describe("Invoice number") },
  );

  registerRead(
    server,
    client,
    "get_cancellation_requests",
    "List of active service cancellation requests (whmcs/get_cancellation_requests).",
    "whmcs",
    "get_cancellation_requests",
    { id: z.number().int().optional().describe("Server ID (filter)") },
  );

  registerRead(
    server,
    client,
    "get_contacts",
    "List of additional account contacts (whmcs/get_contacts).",
    "whmcs",
    "get_contacts",
  );

  registerAction(
    server,
    client,
    "update_billing_client",
    "Update client data in billing (whmcs/update_client): name, company, address, email, phone, etc.",
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
    "Reset the billing account password (whmcs/reset_password): a reset link is sent to the given email. Email must match the account email.",
    "whmcs",
    "reset_password",
    { email: z.string().describe("Account email") },
  );

  registerAction(
    server,
    client,
    "add_contact",
    "Add an additional contact to the account (whmcs/add_contact). WARNING: the contact is created with a random email — change it in Invapi.",
    "whmcs",
    "add_contact",
  );

  registerAction(
    server,
    client,
    "update_contact",
    "Update an additional contact (whmcs/update_contact): email, password, phone. Providing a phone enables SMS 2FA.",
    "whmcs",
    "update_contact",
    {
      contact_id: z.number().int().describe("Contact ID"),
      email: z.string().describe("Contact email"),
      password2: z.string().optional().describe("New contact password"),
      phonenumber: z
        .string()
        .optional()
        .describe("Phone (enables SMS 2FA)"),
    },
  );

  registerAction(
    server,
    client,
    "delete_contact",
    "Delete an additional account contact (whmcs/delete_contact). DESTRUCTIVE.",
    "whmcs",
    "delete_contact",
    { contact_id: z.number().int().describe("Contact ID") },
    { destructive: true },
  );

  registerAction(
    server,
    client,
    "generate_due_invoice",
    "Create the next invoice for a server (whmcs/generate_due_invoice).",
    "whmcs",
    "generate_due_invoice",
    { id: z.number().int().describe("Server ID") },
  );

  registerAction(
    server,
    client,
    "create_addfunds_invoice",
    "Create an invoice to top up the credit balance (whmcs/create_addfunds). MONEY: creates a real invoice for the given amount.",
    "whmcs",
    "create_addfunds",
    { amount: z.number().describe("Top-up amount in account currency") },
  );

  registerAction(
    server,
    client,
    "apply_credit",
    "Pay an invoice in full or in part from the credit balance (whmcs/apply_credit). MONEY: deducts funds from the account.",
    "whmcs",
    "apply_credit",
    {
      invoice_id: z.number().int().describe("Invoice number"),
      amount: z.number().describe("Payment amount in account currency"),
    },
  );

  registerAction(
    server,
    client,
    "mass_pay",
    "Create a group invoice to pay multiple invoices at once (whmcs/mass_pay). MONEY.",
    "whmcs",
    "mass_pay",
    { invoices: z.array(z.number().int()).describe("Array of invoice numbers") },
  );

  registerAction(
    server,
    client,
    "request_cancellation",
    "Request service cancellation (whmcs/request_cancellation). DESTRUCTIVE: cancellation_type=1 — immediate cancel with partial refund (if possible), 0 — cancel at end of billing period. Requires HOSTKEY_ALLOW_DESTRUCTIVE=1.",
    "whmcs",
    "request_cancellation",
    {
      id: z.number().int().describe("Server ID"),
      cancellation_type: z
        .union([z.literal(0), z.literal(1)])
        .describe(
          "1 — immediate (partial refund if possible), 0 — at end of billing period",
        ),
      terminate_reason_custom: z.string().optional().describe("Cancellation reason"),
    },
    { destructive: true, envGuard: true },
  );

  registerAction(
    server,
    client,
    "delete_cancellation_request",
    "Withdraw a service cancellation request (whmcs/delete_cancellation_request).",
    "whmcs",
    "delete_cancellation_request",
    { id: z.number().int().describe("Server ID") },
  );
}
