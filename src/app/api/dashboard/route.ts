import { NextResponse } from "next/server";
import { calculateResults, snapshot } from "@/lib/records";

export async function GET() {
  try { const data = await snapshot(); return NextResponse.json({ ...data, results: calculateResults(data.sales, data.expenses) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load dashboard." }, { status: 500 }); }
}
