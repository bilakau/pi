const { validateRekening } = require("../../api/mustikaPay");
const { setSession, getSession, clearSession } = require("../middleware/session");

const STEP = {
  TIPE: "val_tipe",
  KODE: "val_kode",
  REK: "val_rek",
};

async function handleValidate(bot, msg) {
  const chatId = msg.chat.id;

  // Support format cepat: /validasi bank 014 1234567890
  const parts = msg.text.split(" ");
  if (parts.length === 4) {
    const [, tipe, kode, rek] = parts;
    const processingMsg = await bot.sendMessage(chatId, "🔍 Memvalidasi rekening...");
    try {
      const result = await validateRekening({ tipe, kode, rek });
      await bot.deleteMessage(chatId, processingMsg.message_id);
      if (result.status === "success") {
        await bot.sendMessage(chatId,
          `✅ *Rekening Valid!*\n\n👤 *Nama Pemilik:* ${result.account_name}`,
          { parse_mode: "Markdown" }
        );
      } else {
        await bot.sendMessage(chatId, `❌ Rekening tidak valid atau tidak ditemukan.`);
      }
    } catch (err) {
      await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, `❌ Error: ${err.response?.data?.message || err.message}`);
    }
    return;
  }

  clearSession(chatId);
  setSession(chatId, { action: "validate", step: STEP.TIPE });

  await bot.sendMessage(chatId,
    `🔍 *Validasi Rekening*\n\n` +
    `Pilih tipe:\n• *bank*\n• *ewallet*\n\n` +
    `Ketik tipe:\n_Atau gunakan format cepat: /validasi bank 014 1234567890_\n` +
    `_Ketik /batal untuk membatalkan_`,
    { parse_mode: "Markdown" }
  );
}

async function handleValidateStep(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text.trim().toLowerCase();
  const session = getSession(chatId);

  if (session.action !== "validate") return false;

  if (session.step === STEP.TIPE) {
    if (!["bank", "ewallet"].includes(text)) {
      await bot.sendMessage(chatId, "❌ Ketik *bank* atau *ewallet*:", { parse_mode: "Markdown" });
      return true;
    }
    setSession(chatId, { tipe: text, step: STEP.KODE });
    const hint = text === "bank" ? "kode bank (contoh: 014 untuk BCA)" : "kode ewallet (dana, gopay, ovo, dll)";
    await bot.sendMessage(chatId, `Masukkan ${hint}:`);
    return true;
  }

  if (session.step === STEP.KODE) {
    setSession(chatId, { kode: text, step: STEP.REK });
    const label = session.tipe === "bank" ? "nomor rekening" : "nomor HP";
    await bot.sendMessage(chatId, `Masukkan ${label}:`);
    return true;
  }

  if (session.step === STEP.REK) {
    const s = getSession(chatId);
    const processingMsg = await bot.sendMessage(chatId, "🔍 Memvalidasi...");

    try {
      const result = await validateRekening({ tipe: s.tipe, kode: s.kode, rek: text });
      await bot.deleteMessage(chatId, processingMsg.message_id);

      if (result.status === "success") {
        await bot.sendMessage(chatId,
          `✅ *Rekening Valid!*\n\n` +
          `🏦 *Tipe:* ${s.tipe.toUpperCase()}\n` +
          `📌 *Kode:* ${s.kode}\n` +
          `🔢 *Rekening:* ${text}\n` +
          `👤 *Nama Pemilik:* ${result.account_name}`,
          { parse_mode: "Markdown" }
        );
      } else {
        await bot.sendMessage(chatId, `❌ Rekening tidak valid.`);
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

module.exports = { handleValidate, handleValidateStep };
