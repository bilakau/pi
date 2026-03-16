const { createQRIS, formatRupiah } = require("../../api/mustikaPay");
const { setSession, getSession, clearSession } = require("../middleware/session");

const STEP = {
  AMOUNT: "qris_amount",
  PRODUCT: "qris_product",
  NAME: "qris_name",
  EMAIL: "qris_email",
};

async function handleCreateQRIS(bot, msg) {
  const chatId = msg.chat.id;
  clearSession(chatId);
  setSession(chatId, { action: "create_qris", step: STEP.AMOUNT });

  await bot.sendMessage(chatId,
    `💳 *Buat Pembayaran QRIS*\n\n` +
    `Masukkan nominal pembayaran (contoh: 10000):\n` +
    `_Ketik /batal untuk membatalkan_`,
    { parse_mode: "Markdown" }
  );
}

async function handleQRISStep(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const session = getSession(chatId);

  if (session.action !== "create_qris") return false;

  if (session.step === STEP.AMOUNT) {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount < 1000) {
      await bot.sendMessage(chatId, "❌ Nominal tidak valid. Minimal Rp 1.000. Silakan masukkan ulang:");
      return true;
    }
    setSession(chatId, { amount, step: STEP.PRODUCT });
    await bot.sendMessage(chatId,
      `✅ Nominal: *${formatRupiah(amount)}*\n\nMasukkan nama produk (atau ketik *skip* untuk melewati):`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.PRODUCT) {
    const product_name = text.toLowerCase() === "skip" ? null : text;
    setSession(chatId, { product_name, step: STEP.NAME });
    await bot.sendMessage(chatId,
      `Masukkan nama pelanggan (atau ketik *skip* untuk melewati):`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.NAME) {
    const customer_name = text.toLowerCase() === "skip" ? null : text;
    setSession(chatId, { customer_name, step: STEP.EMAIL });
    await bot.sendMessage(chatId,
      `Masukkan email pelanggan untuk invoice (atau ketik *skip* untuk melewati):`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.EMAIL) {
    const customer_email = text.toLowerCase() === "skip" ? null : text;
    const s = getSession(chatId);

    const processingMsg = await bot.sendMessage(chatId, "⏳ Membuat QRIS, harap tunggu...");

    try {
      const result = await createQRIS({
        amount: s.amount,
        product_name: s.product_name,
        customer_name: s.customer_name,
        customer_email,
      });

      await bot.deleteMessage(chatId, processingMsg.message_id);

      if (result.status === "success") {
        const replyText =
          `✅ *QRIS Berhasil Dibuat!*\n\n` +
          `📌 *Ref No:* \`${result.ref_no}\`\n` +
          `💰 *Nominal:* ${formatRupiah(result.amount)}\n` +
          `🔗 *Payment Link:* [Klik di sini](${result.payment_link})\n` +
          `🖼️ *QR Image:* [Lihat QR](${result.qr_url})\n\n` +
          `_Gunakan /cekpay ${result.ref_no} untuk cek status_`;

        await bot.sendMessage(chatId, replyText, {
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        });

        // Kirim QR sebagai foto
        try {
          await bot.sendPhoto(chatId, result.qr_url, {
            caption: `🔲 QRIS untuk pembayaran ${formatRupiah(result.amount)}`,
          });
        } catch (e) {
          // Abaikan jika gagal kirim foto
        }
      } else {
        await bot.sendMessage(chatId, `❌ Gagal membuat QRIS:\n${JSON.stringify(result)}`);
      }
    } catch (err) {
      await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, `❌ Error: ${err.response?.data?.message || err.message}`);
    }

    clearSession(chatId);
    return true;
  }

  return false;
}

module.exports = { handleCreateQRIS, handleQRISStep };
