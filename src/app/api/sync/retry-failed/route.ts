import { NextRequest, NextResponse } from "next/server";
import { employeeById, snapshot } from "@/lib/records";
import { requireRole } from "@/lib/permissions";
import { database } from "@/lib/supabase";
import { syncExpense, syncSale } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const { actorId } = await request.json();
    requireRole(await employeeById(actorId), "manager");
    const { sales, expenses } = await snapshot();
    const db = database();
    let synced = 0;
    let stillFailed = 0;

    for (const sale of sales.filter((record) => record.sheets_sync_status === "failed")) {
      try {
        const salesperson = await employeeById(sale.salesperson_id);
        await syncSale(sale, salesperson.display_name);
        await db.from("sales").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", sale.id);
        synced += 1;
      } catch (error) {
        await db.from("sales").update({ sheets_sync_status: "failed", sheets_last_error: error instanceof Error ? error.message : "Sheet sync failed" }).eq("id", sale.id);
        stillFailed += 1;
      }
    }

    for (const expense of expenses.filter((record) => record.sheets_sync_status === "failed")) {
      try {
        const reporter = await employeeById(expense.reporter_id);
        await syncExpense(expense, reporter.display_name);
        await db.from("expenses").update({ sheets_sync_status: "synced", sheets_last_error: null }).eq("id", expense.id);
        synced += 1;
      } catch (error) {
        await db.from("expenses").update({ sheets_sync_status: "failed", sheets_last_error: error instanceof Error ? error.message : "Sheet sync failed" }).eq("id", expense.id);
        stillFailed += 1;
      }
    }

    return NextResponse.json({ message: stillFailed ? `${synced} record(s) synced; ${stillFailed} still need attention.` : `${synced} failed record(s) are now synced to Google Sheets.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not retry Google Sheets syncs." }, { status: 400 });
  }
}
