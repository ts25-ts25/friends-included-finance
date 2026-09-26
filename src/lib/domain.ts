import type { Person, Split } from "./finance";

export type Role = "manager" | "salesperson" | "expense_reporter";
export type Project = "A" | "B";
export type Allocation = Project | "Company overhead";
export type SyncStatus = "pending" | "synced" | "failed";

export type Employee = {
  id: string;
  display_name: string;
  role: Role;
  telegram_user_id: number | null;
  telegram_chat_id: number | null;
};

export type Sale = {
  id: string; reference: string; salesperson_id: string; customer: string; project: Project; description: string; amount: number;
  proposed_richard_pct: number; proposed_anastasia_pct: number; proposed_jean_claude_pct: number;
  approved_richard_pct: number | null; approved_anastasia_pct: number | null; approved_jean_claude_pct: number | null;
  richard_commission_amount: number | null; anastasia_commission_amount: number | null; jean_claude_commission_amount: number | null;
  status: "pending" | "approved"; source: "telegram" | "website"; notification_chat_id: number | null; submitted_at: string;
  sheets_sync_status: SyncStatus; sheets_last_error: string | null;
};

export type Expense = {
  id: string; reference: string; reporter_id: string; description: string; category: "Materials" | "Travel" | "Other"; amount: number;
  proposed_allocation: Allocation; final_allocation: Allocation | null; status: "awaiting_allocation" | "allocated";
  source: "telegram" | "website"; notification_chat_id: number | null; submitted_at: string;
  sheets_sync_status: SyncStatus; sheets_last_error: string | null;
};

export const splitFromSale = (sale: Sale, approved = false): Split => ({
  Richard: approved ? sale.approved_richard_pct ?? 0 : sale.proposed_richard_pct,
  Anastasia: approved ? sale.approved_anastasia_pct ?? 0 : sale.proposed_anastasia_pct,
  "Jean-Claude": approved ? sale.approved_jean_claude_pct ?? 0 : sale.proposed_jean_claude_pct
});

export const splitToColumns = (split: Split, prefix: "proposed" | "approved") => ({
  [`${prefix}_richard_pct`]: split.Richard,
  [`${prefix}_anastasia_pct`]: split.Anastasia,
  [`${prefix}_jean_claude_pct`]: split["Jean-Claude"]
});
