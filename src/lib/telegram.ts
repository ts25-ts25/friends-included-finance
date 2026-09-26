import { database } from "./supabase";

export async function sendTelegram(chatId: number | null, text: string, transactionType: "sale" | "expense", reference: string, messageType: "submission_confirmation" | "approval_decision" | "allocation_decision") {
  const db = database();
  if (!chatId) {
    await db.from("notifications").insert({ transaction_type: transactionType, transaction_reference: reference, recipient_chat_id: null, message_type: messageType, delivery_status: "not_applicable", last_error: "No Telegram recipient linked" });
    return { sent: false, reason: "No Telegram recipient linked" };
  }
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Telegram bot is not configured yet.");
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
    if (!response.ok) throw new Error(await response.text());
    await db.from("notifications").insert({ transaction_type: transactionType, transaction_reference: reference, recipient_chat_id: chatId, message_type: messageType, delivery_status: "sent", sent_at: new Date().toISOString() });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram delivery failure";
    await db.from("notifications").insert({ transaction_type: transactionType, transaction_reference: reference, recipient_chat_id: chatId, message_type: messageType, delivery_status: "failed", last_error: message });
    return { sent: false, reason: message };
  }
}
