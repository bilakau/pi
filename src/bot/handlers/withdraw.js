const { withdraw, validateRekening, formatRupiah } = require("../../api/mustikaPay");
const { setSession, getSession, clearSession } = require("../middleware/session");

const STEP = {
  TIPE: "wd_tipe",
  KODE: "wd_kode",
  REK: "wd_rek",
  AMOUNT: "wd_amount",
  CONFIRM: "wd_confirm",
  OTP: "wd_otp",
};

const BANK_LIST = {
  "014": "BCA", "008": "Mandiri", "002": "BRI",
  "009": "BNI", "022": "CIMB", "011": "Danamon",
};

const EWALLET_LIST = ["dana", "gopay", "ovo", "shopeepay", "linkaja"];

async function handleWithdraw(bot, msg) {
  const chatId = msg.chat.id;
  clearSession(chatId);
  setSession(chatId, { action: "withdraw", step: STEP.TIPE });

  await bot.sendMessage(chatId,
    `💸 *Penarikan Dana (Withdraw)*\n\n` +
    `Pilih tipe tujuan:\n• *bank* — Transfer Bank\n• *ewallet* — E-Wallet\n\n` +
    `Ketik *bank* atau *ewallet*:\n` +
    `_Ketik /batal untuk membatalkan_`,
    { parse_mode: "Markdown" }
  );
}

async function handleWithdrawStep(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase();
  const session = getSession(chatId);

  if (session.action !== "withdraw") return false;

  if (session.step === STEP.TIPE) {
    if (!["bank", "ewallet"].includes(text)) {
      await bot.sendMessage(chatId, "❌ Ketik *bank* atau *ewallet*:", { parse_mode: "Markdown" });
      return true;
    }
    setSession(chatId, { tipe: text, step: STEP.KODE });

    if (text === "bank") {
      const bankListText = Object.entries(BANK_LIST)
        .map(([code, name]) => `• \`${code}\` — ${name}`)
        .join("\n");
      await bot.sendMessage(chatId,
        `Pilih kode bank:\n${bankListText}\n\nKetik kode bank (contoh: *014*):`,
        { parse_mode: "Markdown" }
      );
    } else {
      await bot.sendMessage(chatId,
        `Pilih e-wallet:\n${EWALLET_LIST.map(e => `• ${e}`).join("\n")}\n\nKetik nama e-wallet:`,
        { parse_mode: "Markdown" }
      );
    }
    return true;
  }

  if (session.step === STEP.KODE) {
    const kode = text;
    if (session.tipe === "bank" && !BANK_LIST[kode]) {
      await bot.sendMessage(chatId, "❌ Kode bank tidak valid. Masukkan ulang:");
      return true;
    }
    if (session.tipe === "ewallet" && !EWALLET_LIST.includes(kode)) {
      await bot.sendMessage(chatId, `❌ E-wallet tidak valid. Pilih dari: ${EWALLET_LIST.join(", ")}`);
      return true;
    }
    setSession(chatId, { kode, step: STEP.REK });
    const label = session.tipe === "bank" ? "nomor rekening" : "nomor HP tujuan";
    await bot.sendMessage(chatId, `Masukkan ${label}:`);
    return true;
  }

  if (session.step === STEP.REK) {
    const rek = text.replace(/\s/g, "");
    setSession(chatId, { rek, step: STEP.AMOUNT });

    // Coba validasi rekening
    const processingMsg = await bot.sendMessage(chatId, "🔍 Memvalidasi rekening...");
    try {
      const valid = await validateRekening({
        tipe: session.tipe,
        kode: session.kode,
        rek,
      });
      await bot.deleteMessage(chatId, processingMsg.message_id);

      if (valid.status === "success") {
        await bot.sendMessage(chatId,
          `✅ *Rekening Valid!*\n👤 Nama: *${valid.account_name}*\n\nMasukkan nominal withdraw:`,
          { parse_mode: "Markdown" }
        );
        setSession(chatId, { account_name: valid.account_name });
      } else {
        await bot.sendMessage(chatId, `⚠️ Tidak bisa validasi rekening. Lanjutkan?\nMasukkan nominal withdraw:`);
      }
    } catch (e) {
      await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, `⚠️ Validasi gagal, tapi bisa lanjut.\nMasukkan nominal withdraw:`);
    }
    return true;
  }

  if (session.step === STEP.AMOUNT) {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    const min = session.tipe === "ewallet" ? 20000 : 10000;
    if (isNaN(amount) || amount < min) {
      await bot.sendMessage(chatId, `❌ Minimal withdraw: ${formatRupiah(min)}. Masukkan ulang:`);
      return true;
    }
    setSession(chatId, { amount, step: STEP.CONFIRM });

    const s = getSession(chatId);
    const confirmText =
      `📋 *Konfirmasi Withdraw*\n\n` +
      `🏦 Tipe: *${s.tipe.toUpperCase()}*\n` +
      `📌 Kode: *${s.kode}*\n` +
      `🔢 Rekening: *${s.rek}*\n` +
      (s.account_name ? `👤 Nama: *${s.account_name}*\n` : "") +
      `💰 Nominal: *${formatRupiah(amount)}*\n\n` +
      `Ketik *YA* untuk lanjut dan minta OTP, atau *TIDAK* untuk batal:`;

    await bot.sendMessage(chatId, confirmText, { parse_mode: "Markdown" });
    return true;
  }

  if (session.step === STEP.CONFIRM) {
    if (text === "tidak" || text === "batal") {
      clearSession(chatId);
      await bot.sendMessage(chatId, "❌ Withdraw dibatalkan.");
      return true;
    }
    if (text !== "ya") {
      await bot.sendMessage(chatId, "Ketik *YA* untuk konfirmasi atau *TIDAK* untuk batal:", { parse_mode: "Markdown" });
      return true;
    }

    const s = getSession(chatId);
    const processingMsg = await bot.sendMessage(chatId, "⏳ Mengirim request OTP...");
    try {
      const result = await withdraw({
        tipe: s.tipe,
        kode: s.kode,
        rek: s.rek,
        amount: s.amount,
      });
      await bot.deleteMessage(chatId, processingMsg.message_id);
      setSession(chatId, { step: STEP.OTP });
      await bot.sendMessage(chatId,
        `✅ OTP telah dikirim ke Telegram/Email terdaftar.\n\n` +
        `🔐 Masukkan kode OTP yang Anda terima:`,
        { parse_mode: "Markdown" }
      );
    } catch (err) {
      await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, `❌ Error: ${err.response?.data?.message || err.message}`);
      clearSession(chatId);
    }
    return true;
  }

  if (session.step === STEP.OTP) {
    const otp = text;
    const s = getSession(chatId);
    const processingMsg = await bot.sendMessage(chatId, "⏳ Memproses penarikan dana...");

    try {
      const result = await withdraw({
        tipe: s.tipe,
        kode: s.kode,
        rek: s.rek,
        amount: s.amount,
        otp,
      });

      await bot.deleteMessage(chatId, processingMsg.message_id);

      if (result.status === "success") {
        const replyText =
          `✅ *Withdraw Berhasil!*\n\n` +
          `📌 *Ref No:* \`${result.ref_no}\`\n` +
          `📤 *Tipe:* ${result.type}\n` +
          `💬 *Pesan:* ${result.message}\n` +
          `💰 *Saldo Baru:* ${formatRupiah(result.new_balance)}\n\n` +
          `_Gunakan /cekwd ${result.ref_no} untuk cek status_`;
        await bot.sendMessage(chatId, replyText, { parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(chatId, `❌ Withdraw gagal:\n${JSON.stringify(result)}`);
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

module.exports = { handleWithdraw, handleWithdrawStep };
