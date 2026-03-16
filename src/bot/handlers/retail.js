const { createRetail, formatRupiah } = require("../../api/mustikaPay");
const { setSession, getSession, clearSession } = require("../middleware/session");

const STEP = {
  OUTLET: "retail_outlet",
  AMOUNT: "retail_amount",
  NAME: "retail_name",
  EMAIL: "retail_email",
};

async function handleCreateRetail(bot, msg) {
  const chatId = msg.chat.id;
  clearSession(chatId);
  setSession(chatId, { action: "create_retail", step: STEP.OUTLET });

  await bot.sendMessage(chatId,
    `🏪 *Buat Pembayaran Retail*\n\n` +
    `Pilih gerai:\n• 1️⃣ ALFAMART\n• 2️⃣ INDOMARET\n\n` +
    `Ketik *ALFAMART* atau *INDOMARET*:\n` +
    `_Ketik /batal untuk membatalkan_`,
    { parse_mode: "Markdown" }
  );
}

async function handleRetailStep(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text.trim().toUpperCase();
  const session = getSession(chatId);

  if (session.action !== "create_retail") return false;

  if (session.step === STEP.OUTLET) {
    if (!["ALFAMART", "INDOMARET"].includes(text)) {
      await bot.sendMessage(chatId, "❌ Pilih ALFAMART atau INDOMARET:");
      return true;
    }
    setSession(chatId, { retail_outlet: text, step: STEP.AMOUNT });
    await bot.sendMessage(chatId,
      `✅ Gerai: *${text}*\n\nMasukkan nominal pembayaran:`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.AMOUNT) {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount < 10000) {
      await bot.sendMessage(chatId, "❌ Minimal pembayaran Rp 10.000. Masukkan ulang:");
      return true;
    }
    setSession(chatId, { amount, step: STEP.NAME });
    await bot.sendMessage(chatId, `Masukkan nama pelanggan:`);
    return true;
  }

  if (session.step === STEP.NAME) {
    if (text.length < 3) {
      await bot.sendMessage(chatId, "❌ Nama terlalu pendek:");
      return true;
    }
    setSession(chatId, { name: text, step: STEP.EMAIL });
    await bot.sendMessage(chatId, `Masukkan email pelanggan (atau ketik *skip*):`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.EMAIL) {
    const customer_email = msg.text.trim().toLowerCase() === "skip" ? null : msg.text.trim();
    const s = getSession(chatId);
    const processingMsg = await bot.sendMessage(chatId, "⏳ Membuat kode pembayaran retail...");

    try {
      const result = await createRetail({
        amount: s.amount,
        retail_outlet: s.retail_outlet,
        name: s.name,
        customer_email,
      });

      await bot.deleteMessage(chatId, processingMsg.message_id);

      if (result.status === "success") {
        const replyText =
          `✅ *Kode Pembayaran ${s.retail_outlet} Berhasil!*\n\n` +
          `🏪 *Gerai:* ${s.retail_outlet}\n` +
          `🔢 *Kode Bayar:* \`${result.data.paymentCode}\`\n` +
          `💰 *Nominal:* ${formatRupiah(s.amount)}\n` +
          `📌 *Ref No:* \`${result.data.partnerReferenceNo}\`\n` +
          (result.payment_link ? `🔗 *Payment Link:* [Klik di sini](${result.payment_link})\n` : "") +
          `\n_Tunjukkan kode di atas ke kasir ${s.retail_outlet}_`;

        await bot.sendMessage(chatId, replyText, {
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        });
      } else {
        await bot.sendMessage(chatId, `❌ Gagal membuat kode retail:\n${JSON.stringify(result)}`);
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

module.exports = { handleCreateRetail, handleRetailStep };
