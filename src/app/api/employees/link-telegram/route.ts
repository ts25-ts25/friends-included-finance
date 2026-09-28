import { NextRequest, NextResponse } from "next/server";
import { employeeById } from "@/lib/records";
import { requireRole } from "@/lib/permissions";
import { database } from "@/lib/supabase";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json(); requireRole(await employeeById(body.actorId), "manager");
    const userId = Number(body.telegramUserId), chatId = Number(body.telegramChatId);
    if (!body.employeeId || !Number.isSafeInteger(userId) || !Number.isSafeInteger(chatId)) throw new Error("Enter a valid Telegram user ID and chat ID.");
    const db = database();
    // A test account can move between fictional employees. Historical sales and
    // expenses keep their own saved submitter and notification chat IDs.
    const { error: unlinkError } = await db.from("employees").update({ telegram_user_id: null, telegram_chat_id: null }).eq("telegram_user_id", userId).neq("id", body.employeeId);
    if (unlinkError) throw new Error(unlinkError.message);
    const { data, error } = await db.from("employees").update({ telegram_user_id: userId, telegram_chat_id: chatId }).eq("id", body.employeeId).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ employee: data, message: `Telegram account linked to ${data.display_name}.` });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not link Telegram account." }, { status: 400 }); }
}
