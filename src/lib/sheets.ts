import { google } from "googleapis";
import type { Expense, Sale } from "./domain";

const salesHeaders = ["Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount EUR", "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %", "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %", "Richard commission EUR", "Anastasia commission EUR", "Jean-Claude commission EUR", "Status"];
const expenseHeaders = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount EUR", "Proposed allocation", "Final allocation", "Status"];

function client() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!raw || !spreadsheetId) throw new Error("Google Sheets is not configured yet.");
  const credentials = JSON.parse(raw);
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
