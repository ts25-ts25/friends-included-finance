import { NextRequest, NextResponse } from "next/server";
import { employeeById } from "@/lib/records";

export async function POST(request: NextRequest) {
  try {
    const { actorId } = await request.json();
    const actor = await employeeById(actorId);
    if (actor.role !== "manager") return NextResponse.json({ error: "Only the manager may connect the bot." }, { status: 403 });
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Telegram bot is not configured yet.");
    const webhook = `${request.nextUrl.origin}/api/telegram/webhook`;
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: webhook }) });
    if (!response.ok) throw new Error("Telegram rejected the webhook connection.");
    return NextResponse.json({ message: "Telegram bot connected. Open @FriendsIncludedTinaBot and send /start." });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not connect the bot." }, { status: 400 }); }
}
