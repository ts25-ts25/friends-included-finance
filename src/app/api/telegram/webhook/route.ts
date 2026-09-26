import { NextRequest, NextResponse } from "next/server";
import { assertSplit } from "@/lib/finance";
import { employeeByTelegramUserId } from "@/lib/records";
import { database } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { syncExpense, syncSale } from "@/lib/sheets";
import type { Expense, Sale } from "@/lib/domain";

const help = "Commands:\n/sale REF|Customer|A or B|Description|Amount|Richard %|Anastasia %|Jean-Claude %\n/expense REF|Description|Materials, Travel, or Other|Amount|A, B, or Company overhead\n\nSend /start to see your Telegram user ID for manager setup.";

export async function POST(request: NextRequest) {
  let failureChatId: number | null = null;
  try {
    const update = await request.json(); const message = update.message;
    if (!message?.text || !message?.from?.id || !message?.chat?.id) return NextResponse.json({ ok: true });
    const text = String(message.text).trim(), userId = Number(message.from.id), chatId = Number(message.chat.id); failureChatId = chatId;
    if (text === "/start") { await sendTelegram(chatId, `Your Telegram user ID is ${userId}. Ask Svetlana to link it to your fictional employee.\n\n${help}`, "sale", "START", "submission_confirmation"); return NextResponse.json({ ok: true }); }
    const employee = await employeeByTelegramUserId(userId);
    if (!employee) { await sendTelegram(chatId, "Your Telegram account is not linked to a fictional employee. Ask Svetlana to link your Telegram user ID in Manager setup.", "sale", "UNLINKED", "submission_confirmation"); return NextResponse.json({ ok: true }); }
    const parts = text.split(" "); const command = parts.shift()?.toLowerCase(); const values = parts.join(" ").split("|").map((value) => value.trim()); const db = database();
    if (command === "/sale") {
      if (employee.role !== "salesperson") throw new Error("Denied: your linked role may not submit sales.");
      if (values.length !== 8) throw new Error(`Incorrect sale format.\n\n${help}`);
      const [reference, customer, project, description, rawAmount, richard, anastasia, jeanClaude] = values; const amount = Number(rawAmount); const split = { Richard: Number(richard), Anastasia: Number(anastasia), "Jean-Claude": Number(jeanClaude) };
      if (!reference || !customer || !["A", "B"].includes(project) || !description || amount <= 0) throw new Error("A sale needs every required field and a positive amount."); assertSplit(split);
      const { data, error } = await db.from("sales").insert({ reference, salesperson_id: employee.id, customer, project, description, amount, proposed_richard_pct: split.Richard, proposed_anastasia_pct: split.Anastasia, proposed_jean_claude_pct: split["Jean-Claude"], source: "telegram", originating_telegram_chat_id: chatId, notification_chat_id: chatId }).select().single();
      if (error) throw new Error(error.code === "23505" ? "This reference already exists." : error.message); const sale = data as Sale;
      try { await syncSale(sale, employee.display_name); await db.from("sales").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", sale.id); } catch (syncError) { await db.from("sales").update({ sheets_sync_status: "failed", sheets_last_error: syncError instanceof Error ? syncError.message : "Sheet sync failed" }).eq("id", sale.id); }
      await sendTelegram(chatId, `Sale ${reference} recorded. Amount €${amount.toFixed(2)}; Project ${project}; status Pending approval.`, "sale", reference, "submission_confirmation"); return NextResponse.json({ ok: true });
    }
    if (command === "/expense") {
      if (employee.role !== "expense_reporter") throw new Error("Denied: your linked role may not submit expenses.");
      if (values.length !== 5) throw new Error(`Incorrect expense format.\n\n${help}`);
      const [reference, description, category, rawAmount, proposedAllocation] = values; const amount = Number(rawAmount), automatic = proposedAllocation === "Company overhead";
      if (!reference || !description || !["Materials", "Travel", "Other"].includes(category) || !["A", "B", "Company overhead"].includes(proposedAllocation) || amount <= 0) throw new Error("An expense needs every required field and a positive amount.");
      const { data, error } = await db.from("expenses").insert({ reference, reporter_id: employee.id, description, category, amount, proposed_allocation: proposedAllocation, final_allocation: automatic ? proposedAllocation : null, status: automatic ? "allocated" : "awaiting_allocation", source: "telegram", originating_telegram_chat_id: chatId, notification_chat_id: chatId, allocated_at: automatic ? new Date().toISOString() : null }).select().single();
      if (error) throw new Error(error.code === "23505" ? "This reference already exists." : error.message); const expense = data as Expense;
      try { await syncExpense(expense, employee.display_name); await db.from("expenses").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", expense.id); } catch (syncError) { await db.from("expenses").update({ sheets_sync_status: "failed", sheets_last_error: syncError instanceof Error ? syncError.message : "Sheet sync failed" }).eq("id", expense.id); }
      await sendTelegram(chatId, `Expense ${reference} recorded. €${amount.toFixed(2)}; proposed ${proposedAllocation}; status ${automatic ? "allocated to Company overhead" : "Awaiting allocation"}.`, "expense", reference, "submission_confirmation"); return NextResponse.json({ ok: true });
    }
    await sendTelegram(chatId, help, "sale", "HELP", "submission_confirmation"); return NextResponse.json({ ok: true });
  } catch (error) { const message = error instanceof Error ? error.message : "Could not process your message."; if (failureChatId) await sendTelegram(failureChatId, `Submission failed: ${message}`, "sale", "FAILED", "submission_confirmation"); return NextResponse.json({ ok: true }); }
}
