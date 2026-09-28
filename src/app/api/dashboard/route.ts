import { NextRequest, NextResponse } from "next/server";
import { calculateResults, snapshot } from "@/lib/records";

export async function GET(request: NextRequest) {
  try {
    const data = await snapshot();
    const actorId = request.nextUrl.searchParams.get("actorId");
    if (!actorId) return NextResponse.json({ employees: data.employees, sales: [], expenses: [], results: null });

    const actor = data.employees.find((employee) => employee.id === actorId);
    if (!actor) return NextResponse.json({ error: "Choose a valid demonstration role." }, { status: 400 });

    if (actor.role === "manager") return NextResponse.json({ ...data, results: calculateResults(data.sales, data.expenses) });
    if (actor.role === "salesperson") return NextResponse.json({ employees: data.employees, sales: data.sales.filter((sale) => sale.salesperson_id === actor.id), expenses: [], results: null });
    return NextResponse.json({ employees: data.employees, sales: [], expenses: data.expenses.filter((expense) => expense.reporter_id === actor.id), results: null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load dashboard." }, { status: 500 });
  }
}
