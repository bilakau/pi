const { cekPay, cekWD, formatRupiah } = require("../../api/mustikaPay");

async function handleCekPay(bot, msg) {
  const chatId = msg.chat.id;
  const args = msg.text.split(" ");
  const refNo = args[1];

  if (!refNo) {
    await bot.sendMessage(chatId,
      `❌ Format salah!\nGunakan: /cekpay <ref_no>\n\nContoh: /cekpay QR20240308abc`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const processingMsg = await bot.sendMessage(chatId, "⏳ Mengecek status pembayaran...");

  try {
    const result = await cekPay(refNo);
    await bot.deleteMessage(chatId, processingMsg.message_id);

    const statusEmoji = result.status?.toLowerCase() === "success" ? "✅" :
                        result.status?.toLowerCase() === "pending" ? "⏳" : "❌";

    const replyText =
      `${statusEmoji} *Status Pembayaran*\n\n` +
      `📌 *Ref No:* \`${result.ref_no}\`\n` +
      `📊 *Status:* ${result.status}\n` +
      `📋 *Tipe:* ${result.type || "-"}\n`;

    await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" });
  } catch (err) {
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Gagal cek status: ${err.response?.data?.message || err.message}`);
  }
}

async function handleCekWD(bot, msg) {
  const chatId = msg.chat.id;
  const args = msg.text.split(" ");
  const refNo = args[1];

  if (!refNo) {
    await bot.sendMessage(chatId,
      `❌ Format salah!\nGunakan: /cekwd <ref_no>\n\nContoh: /cekwd WD20240308abc`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const processingMsg = await bot.sendMessage(chatId, "⏳ Mengecek status withdraw...");

  try {
    const result = await cekWD(refNo);
    await bot.deleteMessage(chatId, processingMsg.message_id);

    const statusEmoji = result.status?.toLowerCase() === "success" ? "✅" :
                        result.status?.toLowerCase() === "pending" ? "⏳" : "❌";

    const replyText =
      `${statusEmoji} *Status Withdraw*\n\n` +
      `📌 *Ref No:* \`${result.ref_no}\`\n` +
      `📊 *Status:* ${result.status}\n` +
      `📋 *Tipe:* ${result.type || "-"}\n`;

    await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" });
  } catch (err) {
    await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId, `❌ Gagal cek status WD: ${err.response?.data?.message || err.message}`);
  }
}

module.exports = { handleCekPay, handleCekWD };
