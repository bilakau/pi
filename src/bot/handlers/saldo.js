const { cekSaldo, formatRupiah } = require("../../api/mustikaPay");

async function handleCekSaldo(bot, msg) {
  const chatId = msg.chat.id;
  const args = msg.text.split(" ");
  const username = args[1] || null;

  const processingMsg = await bot.sendMessage(chatId, "⏳ Mengecek saldo...");

  try {
    const result = await cekSaldo(username);
    await bot.deleteMessage(chatId, processingMsg.message_id);

    const replyText =
      `💰 *Informasi Saldo MustikaPay*\n\n` +
      `👤 *Username:* ${result.username}\n` +
      `✅ *Saldo Tersedia:* ${formatRupiah(result.balance_available)}\n` +
      `⏳ *Saldo Pending:* ${formatRupiah(result.balance_pending)}\n\n` +
      `_Saldo tersedia dapat langsung di-withdraw_`;

    await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" });
  } catch (err) {
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Gagal cek saldo: ${err.response?.data?.message || err.message}`);
  }
}

module.exports = { handleCekSaldo };
