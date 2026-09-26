import { database } from "./supabase";
import type { Employee, Expense, Sale } from "./domain";

export async function employeeById(id: string) {
  const { data, error } = await database().from("employees").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as Employee;
}

export async function employeeByTelegramUserId(userId: number) {
  const { data, error } = await database().from("employees").select("*").eq("telegram_user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Employee | null;
}

export async function snapshot() {
  const db = database();
  const [employeesResult, salesResult, expensesResult] = await Promise.all([
    db.from("employees").select("*").order("display_name"),
    db.from("sales").select("*").order("submitted_at", { ascending: false }),
    db.from("expenses").select("*").order("submitted_at", { ascending: false })
  ]);
  for (const result of [employeesResult, salesResult, expensesResult]) if (result.error) throw new Error(result.error.message);
  return { employees: employeesResult.data as Employee[], sales: salesResult.data as Sale[], expenses: expensesResult.data as Expense[] };
}

export function calculateResults(sales: Sale[], expenses: Expense[]) {
  const approved = sales.filter((sale) => sale.status === "approved");
  const project = (code: "A" | "B") => {
    const relevantSales = approved.filter((sale) => sale.project === code);
    const income = relevantSales.reduce((sum, sale) => sum + Number(sale.amount), 0);
    const commissions = relevantSales.reduce((sum, sale) => sum + Number(sale.richard_commission_amount ?? 0) + Number(sale.anastasia_commission_amount ?? 0) + Number(sale.jean_claude_commission_amount ?? 0), 0);
    const costs = expenses.filter((expense) => expense.final_allocation === code).reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { income, commissions, costs, result: income - commissions - costs };
  };
  const a = project("A"), b = project("B");
  const allIncome = approved.reduce((sum, sale) => sum + Number(sale.amount), 0);
  const allCommissions = approved.reduce((sum, sale) => sum + Number(sale.richard_commission_amount ?? 0) + Number(sale.anastasia_commission_amount ?? 0) + Number(sale.jean_claude_commission_amount ?? 0), 0);
  const allExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const earned = approved.reduce((totals, sale) => ({
    Richard: totals.Richard + Number(sale.richard_commission_amount ?? 0),
    Anastasia: totals.Anastasia + Number(sale.anastasia_commission_amount ?? 0),
    "Jean-Claude": totals["Jean-Claude"] + Number(sale.jean_claude_commission_amount ?? 0)
  }), { Richard: 0, Anastasia: 0, "Jean-Claude": 0 });
  return {
    projects: { A: a, B: b }, company: { income: allIncome, commissions: allCommissions, expenses: allExpenses, result: allIncome - allCommissions - allExpenses },
    overhead: expenses.filter((expense) => expense.final_allocation === "Company overhead").reduce((sum, expense) => sum + Number(expense.amount), 0),
    awaitingAllocation: expenses.filter((expense) => expense.status === "awaiting_allocation").reduce((sum, expense) => sum + Number(expense.amount), 0),
    earned
  };
}
