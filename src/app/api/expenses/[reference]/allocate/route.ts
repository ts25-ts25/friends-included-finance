import { NextRequest, NextResponse } from "next/server";
import { employeeById } from "@/lib/records";
import { requireRole } from "@/lib/permissions";
import { database } from "@/lib/supabase";
import { syncExpense } from "@/lib/sheets";
import { sendTelegram } from "@/lib/telegram";
import type { Allocation, Expense } from "@/lib/domain";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params; const body = await request.json();
    const manager = requireRole(await employeeById(body.actorId), "manager"); const allocation = body.allocation as Allocation;
    if (!["A", "B", "Company overhead"].includes(allocation)) throw new Error("Choose Project A, Project B, or Company overhead.");
    const db = database(); const { data: current, error: lookupError } = await db.from("expenses").select("*").eq("reference", reference).single();
    if (lookupError) throw new Error("Expense not found."); if (current.status === "allocated") return NextResponse.json({ expense: current, message: "Expense was already allocated; totals were not changed." });
    const { data, error } = await db.from("expenses").update({ final_allocation: allocation, status: "allocated", allocated_by: manager.id, allocated_at: new Date().toISOString() }).eq("id", current.id).select().single();
    if (error) throw new Error(error.message); const expense = data as Expense;
    const changed = expense.proposed_allocation !== allocation;
    const text = `Expense ${expense.reference}${changed ? " - allocation changed" : " - allocation confirmed"}. €${Number(expense.amount).toFixed(2)}: ${expense.description}. Proposed: ${expense.proposed_allocation}. Approved: ${allocation}.`;
    try { const reporter = await employeeById(expense.reporter_id); await syncExpense(expense, reporter.display_name); await db.from("expenses").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", expense.id); } catch (syncError) { await db.from("expenses").update({ sheets_sync_status: "failed", sheets_last_error: syncError instanceof Error ? syncError.message : "Sheet sync failed" }).eq("id", expense.id); }
    await sendTelegram(expense.notification_chat_id, text, "expense", expense.reference, "allocation_decision");
    return NextResponse.json({ expense, message: text });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not allocate expense." }, { status: 400 }); }
}
