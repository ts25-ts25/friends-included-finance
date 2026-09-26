import { google } from "googleapis";
import type { Expense, Sale } from "./domain";

const salesHeaders = ["Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount EUR", "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %", "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %", "Richard commission EUR", "Anastasia commission EUR", "Jean-Claude commission EUR", "Status"];
const expenseHeaders = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount EUR", "Proposed allocation", "Final allocation", "Status"];

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccountFromEnv(raw: string): ServiceAccount {
  // Vercel accepts a few normal ways of pasting JSON: raw JSON, a quoted JSON
  // string, or an entry copied from an .env file. Treat them identically.
  const value = raw.trim().replace(/^GOOGLE_SERVICE_ACCOUNT_JSON\s*=\s*/, "");
  try {
    const decoded: unknown = JSON.parse(value);
    const credentials = typeof decoded === "string" ? JSON.parse(decoded) : decoded;
    if (typeof credentials !== "object" || credentials === null || !("client_email" in credentials) || !("private_key" in credentials)) throw new Error();
    return credentials as ServiceAccount;
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const credentials = JSON.parse(value.slice(start, end + 1)) as ServiceAccount;
      if (credentials.client_email && credentials.private_key) return credentials;
    }
    throw new Error("Google service-account JSON could not be read. Paste the complete downloaded JSON file into the Vercel value field.");
  }
}

function client() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!raw || !spreadsheetId) throw new Error("Google Sheets is not configured yet.");
  const credentials = serviceAccountFromEnv(raw);
  return { spreadsheetId, api: google.sheets({ version: "v4", auth: new google.auth.JWT({ email: credentials.client_email, key: credentials.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] }) }) };
}

async function upsertRow(tab: string, headers: string[], reference: string, values: (string | number | null)[]) {
  const { api, spreadsheetId } = client();
  const existing = await api.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:A` });
  const rows = existing.data.values ?? [];
  if (rows.length === 0) await api.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A1`, valueInputOption: "USER_ENTERED", requestBody: { values: [headers] } });
  const index = rows.findIndex((row) => row[0] === reference);
  const rowNumber = index >= 1 ? index + 1 : Math.max(2, rows.length + 1);
  await api.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A${rowNumber}`, valueInputOption: "USER_ENTERED", requestBody: { values: [values] } });
}

export async function syncSale(sale: Sale, salesperson: string) {
  await upsertRow("Sales", salesHeaders, sale.reference, [sale.reference, sale.submitted_at, salesperson, sale.customer, sale.project, sale.description, sale.amount, sale.proposed_richard_pct, sale.proposed_anastasia_pct, sale.proposed_jean_claude_pct, sale.approved_richard_pct, sale.approved_anastasia_pct, sale.approved_jean_claude_pct, sale.richard_commission_amount, sale.anastasia_commission_amount, sale.jean_claude_commission_amount, sale.status]);
}

export async function syncExpense(expense: Expense, reporter: string) {
  await upsertRow("Expenses", expenseHeaders, expense.reference, [expense.reference, expense.submitted_at, reporter, expense.description, expense.category, expense.amount, expense.proposed_allocation, expense.final_allocation, expense.status]);
}
