import { NextRequest, NextResponse } from "next/server";
import { assertSplit, commissionForSale, type Split } from "@/lib/finance";
import { employeeById } from "@/lib/records";
import { requireRole } from "@/lib/permissions";
import { database } from "@/lib/supabase";
import { syncSale } from "@/lib/sheets";
import { sendTelegram } from "@/lib/telegram";
import type { Sale } from "@/lib/domain";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  try {
    const { reference } = await params; const body = await request.json();
    const manager = requireRole(await employeeById(body.actorId), "manager");
    const split = body.split as Split; assertSplit(split);
    const db = database(); const { data: current, error: lookupError } = await db.from("sales").select("*").eq("reference", reference).single();
    if (lookupError) throw new Error("Sale not found."); if (current.status === "approved") return NextResponse.json({ sale: current, message: "Sale was already approved; totals were not changed." });
    const commission = commissionForSale(Number(current.amount), split);
    const { data, error } = await db.from("sales").update({ approved_richard_pct: split.Richard, approved_anastasia_pct: split.Anastasia, approved_jean_claude_pct: split["Jean-Claude"], richard_commission_amount: commission.amounts.Richard, anastasia_commission_amount: commission.amounts.Anastasia, jean_claude_commission_amount: commission.amounts["Jean-Claude"], status: "approved", approved_by: manager.id, approved_at: new Date().toISOString() }).eq("id", current.id).select().single();
    if (error) throw new Error(error.message); const sale = data as Sale;
    const changed = current.proposed_richard_pct !== split.Richard || current.proposed_anastasia_pct !== split.Anastasia || current.proposed_jean_claude_pct !== split["Jean-Claude"];
    const text = `Sale ${sale.reference} approved${changed ? " - commission split changed" : ""}. Sale €${Number(sale.amount).toFixed(2)}; total commission €${commission.pool.toFixed(2)}. Richard: ${split.Richard}% (€${commission.amounts.Richard.toFixed(2)}). Anastasia: ${split.Anastasia}% (€${commission.amounts.Anastasia.toFixed(2)}). Jean-Claude: ${split["Jean-Claude"]}% (€${commission.amounts["Jean-Claude"].toFixed(2)}).`;
    try { const employee = await employeeById(sale.salesperson_id); await syncSale(sale, employee.display_name); await db.from("sales").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", sale.id); } catch (syncError) { await db.from("sales").update({ sheets_sync_status: "failed", sheets_last_error: syncError instanceof Error ? syncError.message : "Sheet sync failed" }).eq("id", sale.id); }
    await sendTelegram(sale.notification_chat_id, text, "sale", sale.reference, "approval_decision");
    return NextResponse.json({ sale, message: text });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not approve sale." }, { status: 400 }); }
}
