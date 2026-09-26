import { NextRequest, NextResponse } from "next/server";
import { assertSplit, type Split } from "@/lib/finance";
import { employeeById } from "@/lib/records";
import { requireRole } from "@/lib/permissions";
import { database } from "@/lib/supabase";
import { syncSale } from "@/lib/sheets";
import { sendTelegram } from "@/lib/telegram";
import type { Sale } from "@/lib/domain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actor = requireRole(await employeeById(body.actorId), "salesperson");
    const amount = Number(body.amount);
    if (!body.reference || !body.customer || !body.description || !["A", "B"].includes(body.project) || !Number.isFinite(amount) || amount <= 0) throw new Error("Please provide every required sale field and an amount greater than zero.");
    const split = body.split as Split; assertSplit(split);
    const db = database();
    const { data, error } = await db.from("sales").insert({ reference: String(body.reference).trim(), salesperson_id: actor.id, customer: String(body.customer).trim(), project: body.project, description: String(body.description).trim(), amount, proposed_richard_pct: split.Richard, proposed_anastasia_pct: split.Anastasia, proposed_jean_claude_pct: split["Jean-Claude"], source: body.source === "telegram" ? "telegram" : "website", originating_telegram_chat_id: body.originatingChatId ?? null, notification_chat_id: body.originatingChatId ?? actor.telegram_chat_id ?? null }).select().single();
    if (error) throw new Error(error.code === "23505" ? "This reference already exists." : error.message);
    const sale = data as Sale;
    try { await syncSale(sale, actor.display_name); await db.from("sales").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", sale.id); }
    catch (syncError) { await db.from("sales").update({ sheets_sync_status: "failed", sheets_last_error: syncError instanceof Error ? syncError.message : "Sheet sync failed" }).eq("id", sale.id); }
    const confirmation = `Sale ${sale.reference} recorded. Amount €${amount.toFixed(2)}; Project ${sale.project}; status Pending approval.`;
    if (body.source === "telegram") await sendTelegram(sale.notification_chat_id, confirmation, "sale", sale.reference, "submission_confirmation");
    return NextResponse.json({ sale, message: confirmation }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save sale." }, { status: 400 }); }
}
