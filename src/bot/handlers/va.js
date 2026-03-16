const { createVA, formatRupiah } = require("../../api/mustikaPay");
const { setSession, getSession, clearSession } = require("../middleware/session");

const BANK_LIST = {
  "014": "BCA",
  "008": "Mandiri",
  "002": "BRI",
  "009": "BNI",
  "022": "CIMB Niaga",
  "011": "Danamon",
};

const STEP = {
  BANK: "va_bank",
  AMOUNT: "va_amount",
  NAME: "va_name",
  EMAIL: "va_email",
};

async function handleCreateVA(bot, msg) {
  const chatId = msg.chat.id;
  clearSession(chatId);
  setSession(chatId, { action: "create_va", step: STEP.BANK });

  const bankListText = Object.entries(BANK_LIST)
    .map(([code, name]) => `• \`${code}\` — ${name}`)
    .join("\n");

  await bot.sendMessage(chatId,
    `🏦 *Buat Virtual Account*\n\n` +
    `Pilih kode bank berikut:\n${bankListText}\n\n` +
    `Ketik kode bank (contoh: *014* untuk BCA):\n` +
    `_Ketik /batal untuk membatalkan_`,
    { parse_mode: "Markdown" }
  );
}

async function handleVAStep(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const session = getSession(chatId);

  if (session.action !== "create_va") return false;

  if (session.step === STEP.BANK) {
    if (!BANK_LIST[text]) {
      await bot.sendMessage(chatId,
        `❌ Kode bank tidak valid. Pilih dari:\n` +
        Object.entries(BANK_LIST).map(([c, n]) => `• \`${c}\` — ${n}`).join("\n"),
        { parse_mode: "Markdown" }
      );
      return true;
    }
    setSession(chatId, { bank_code: text, bank_name: BANK_LIST[text], step: STEP.AMOUNT });
    await bot.sendMessage(chatId,
      `✅ Bank: *${BANK_LIST[text]}*\n\nMasukkan nominal pembayaran:`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.AMOUNT) {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount < 10000) {
      await bot.sendMessage(chatId, "❌ Minimal pembayaran VA adalah Rp 10.000. Masukkan ulang:");
      return true;
    }
    setSession(chatId, { amount, step: STEP.NAME });
    await bot.sendMessage(chatId, `Masukkan nama pelanggan (akan tampil di ATM):`);
    return true;
  }

  if (session.step === STEP.NAME) {
    if (text.length < 3) {
      await bot.sendMessage(chatId, "❌ Nama terlalu pendek. Minimal 3 karakter:");
      return true;
    }
    setSession(chatId, { name: text.toUpperCase(), step: STEP.EMAIL });
    await bot.sendMessage(chatId, `Masukkan email pelanggan untuk invoice (atau ketik *skip*):`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  if (session.step === STEP.EMAIL) {
    const customer_email = text.toLowerCase() === "skip" ? null : text;
    const s = getSession(chatId);
    const processingMsg = await bot.sendMessage(chatId, "⏳ Membuat Virtual Account...");

    try {
      const result = await createVA({
        amount: s.amount,
        bank_code: s.bank_code,
        name: s.name,
        customer_email,
      });

      await bot.deleteMessage(chatId, processingMsg.message_id);

      if (result.status === "success") {
        const vaData = result.data;
        const replyText =
          `✅ *Virtual Account Berhasil Dibuat!*\n\n` +
          `🏦 *Bank:* ${s.bank_name}\n` +
          `🔢 *No. VA:* \`${vaData.virtualAccountNo}\`\n` +
          `👤 *Nama:* ${vaData.virtualAccountName}\n` +
          `💰 *Nominal:* ${formatRupiah(s.amount)}\n` +
          `📌 *Ref No:* \`${vaData.partnerReferenceNo}\`\n\n` +
          `_Gunakan /cekpay ${vaData.partnerReferenceNo} untuk cek status_`;

        await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, `❌ Gagal membuat VA:\n${JSON.stringify(result)}`);
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

module.exports = { handleCreateVA, handleVAStep, BANK_LIST };
