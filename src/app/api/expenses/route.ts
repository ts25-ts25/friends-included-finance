import { NextRequest, NextResponse } from "next/server";
import { employeeById } from "@/lib/records";
import { requireRole } from "@/lib/permissions";
import { database } from "@/lib/supabase";
import { syncExpense } from "@/lib/sheets";
import { sendTelegram } from "@/lib/telegram";
import type { Expense } from "@/lib/domain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actor = requireRole(await employeeById(body.actorId), "expense_reporter");
    const amount = Number(body.amount);
    const allocation = body.proposedAllocation;
    if (!body.reference || !body.description || !["Materials", "Travel", "Other"].includes(body.category) || !["A", "B", "Company overhead"].includes(allocation) || !Number.isFinite(amount) || amount <= 0) throw new Error("Please provide every required expense field and an amount greater than zero.");
    const automaticOverhead = allocation === "Company overhead";
    const db = database();
    const { data, error } = await db.from("expenses").insert({ reference: String(body.reference).trim(), reporter_id: actor.id, description: String(body.description).trim(), category: body.category, amount, proposed_allocation: allocation, final_allocation: automaticOverhead ? allocation : null, status: automaticOverhead ? "allocated" : "awaiting_allocation", source: body.source === "telegram" ? "telegram" : "website", originating_telegram_chat_id: body.originatingChatId ?? null, notification_chat_id: body.originatingChatId ?? actor.telegram_chat_id ?? null, allocated_at: automaticOverhead ? new Date().toISOString() : null }).select().single();
    if (error) throw new Error(error.code === "23505" ? "This reference already exists." : error.message);
    const expense = data as Expense;
    try { await syncExpense(expense, actor.display_name); await db.from("expenses").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", expense.id); }
    catch (syncError) { await db.from("expenses").update({ sheets_sync_status: "failed", sheets_last_error: syncError instanceof Error ? syncError.message : "Sheet sync failed" }).eq("id", expense.id); }
    const status = automaticOverhead ? "allocated to Company overhead" : "Awaiting allocation";
    const confirmation = `Expense ${expense.reference} recorded. €${amount.toFixed(2)}: ${expense.description}. Proposed allocation: ${allocation}; status ${status}.`;
    if (body.source === "telegram") await sendTelegram(expense.notification_chat_id, confirmation, "expense", expense.reference, "submission_confirmation");
    return NextResponse.json({ expense, message: confirmation }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save expense." }, { status: 400 }); }
}
