const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const { handleCreateQRIS, handleQRISStep } = require("./handlers/qris");
const { handleCreateVA, handleVAStep } = require("./handlers/va");
const { handleCreateRetail, handleRetailStep } = require("./handlers/retail");
const { handleWithdraw, handleWithdrawStep } = require("./handlers/withdraw");
const { handleCekSaldo } = require("./handlers/saldo");
const { handleCekPay, handleCekWD } = require("./handlers/cekpay");
const { handleValidate, handleValidateStep } = require("./handlers/validate");
const { generatePaymentLink, formatRupiah } = require("../api/mustikaPay");
const { clearSession, getSession } = require("./middleware/session");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID
  ? parseInt(process.env.TELEGRAM_ADMIN_ID)
  : null;

if (!BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN tidak ditemukan di .env!");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ─────────────────────────────────────────────
//  MIDDLEWARE: Cek Admin
// ─────────────────────────────────────────────
function isAdmin(chatId) {
  if (!ADMIN_ID) return true; // Jika tidak di-set, izinkan semua
  return chatId === ADMIN_ID;
}

// ─────────────────────────────────────────────
//  COMMAND: /start & /help
// ─────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || "Pengguna";

  const welcomeText =
    `🏦 *Selamat datang di MustikaPay Bot!*\n` +
    `Halo, *${firstName}*! 👋\n\n` +
    `Bot ini terintegrasi dengan MustikaPay untuk memudahkan pengelolaan pembayaran Anda.\n\n` +
    `📋 *Menu Utama:*\n\n` +
    `💳 *Pembayaran*\n` +
    `• /qris — Buat pembayaran QRIS Dinamis\n` +
    `• /va — Buat Virtual Account\n` +
    `• /retail — Buat kode Alfamart/Indomaret\n` +
    `• /paylink — Generate Direct Payment Link\n\n` +
    `📊 *Status & Info*\n` +
    `• /cekpay <ref_no> — Cek status pembayaran\n` +
    `• /cekwd <ref_no> — Cek status withdraw\n` +
    `• /saldo — Cek saldo akun\n\n` +
    `💸 *Penarikan Dana*\n` +
    `• /wd — Withdraw ke Bank/E-Wallet\n\n` +
    `🔍 *Utilitas*\n` +
    `• /validasi — Validasi rekening/e-wallet\n` +
    `• /batal — Batalkan proses aktif\n` +
    `• /help — Tampilkan bantuan ini`;

  await bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const helpText =
    `📖 *Panduan Penggunaan MustikaPay Bot*\n\n` +
    `*1. Buat QRIS* → /qris\n` +
    `   Ikuti langkah input nominal, nama produk, nama pelanggan, email\n\n` +
    `*2. Buat VA* → /va\n` +
    `   Input kode bank, nominal, nama pelanggan\n\n` +
    `*3. Buat Retail* → /retail\n` +
    `   Pilih Alfamart/Indomaret, input nominal & nama\n\n` +
    `*4. Payment Link Cepat* → /paylink <nominal>\n` +
    `   Contoh: /paylink 50000\n\n` +
    `*5. Cek Status* → /cekpay <ref_no>\n` +
    `   Contoh: /cekpay QR20240308abc\n\n` +
    `*6. Withdraw* → /wd\n` +
    `   Memerlukan OTP yang dikirim ke Telegram/Email\n\n` +
    `*7. Cek Saldo* → /saldo\n\n` +
    `*8. Validasi Rekening* → /validasi\n` +
    `   Format cepat: /validasi bank 014 1234567890`;

  await bot.sendMessage(chatId, helpText, { parse_mode: "Markdown" });
});

// ─────────────────────────────────────────────
//  COMMAND: /batal
// ─────────────────────────────────────────────
bot.onText(/\/batal/, async (msg) => {
  clearSession(msg.chat.id);
  await bot.sendMessage(msg.chat.id, "❌ Proses dibatalkan. Kembali ke menu utama dengan /start");
});

// ─────────────────────────────────────────────
//  COMMAND: /qris
// ─────────────────────────────────────────────
bot.onText(/\/qris/, (msg) => handleCreateQRIS(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /va
// ─────────────────────────────────────────────
bot.onText(/\/va/, (msg) => handleCreateVA(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /retail
// ─────────────────────────────────────────────
bot.onText(/\/retail/, (msg) => handleCreateRetail(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /paylink
// ─────────────────────────────────────────────
bot.onText(/\/paylink(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(" ");
  const amount = parseInt(args[0]);

  if (!amount || isNaN(amount) || amount < 1000) {
    await bot.sendMessage(chatId,
      `❌ Format salah!\nGunakan: /paylink <nominal> [order_id]\n\nContoh:\n• /paylink 50000\n• /paylink 50000 INV123`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const order_id = args[1] || null;
  const link = generatePaymentLink({
    amount,
    order_id,
  });

  await bot.sendMessage(chatId,
    `🔗 *Direct Payment Link*\n\n` +
    `💰 *Nominal:* ${formatRupiah(amount)}\n` +
    (order_id ? `📌 *Order ID:* ${order_id}\n` : "") +
    `\n🌐 *Link:*\n${link}\n\n` +
    `_Share link ini ke pelanggan untuk pembayaran langsung_`,
    { parse_mode: "Markdown", disable_web_page_preview: true }
  );
});

// ─────────────────────────────────────────────
//  COMMAND: /cekpay
// ─────────────────────────────────────────────
bot.onText(/\/cekpay/, (msg) => handleCekPay(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /cekwd
// ─────────────────────────────────────────────
bot.onText(/\/cekwd/, (msg) => handleCekWD(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /saldo
// ─────────────────────────────────────────────
bot.onText(/\/saldo/, (msg) => handleCekSaldo(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /wd
// ─────────────────────────────────────────────
bot.onText(/\/wd$/, (msg) => handleWithdraw(bot, msg));

// ─────────────────────────────────────────────
//  COMMAND: /validasi
// ─────────────────────────────────────────────
bot.onText(/\/validasi(.*)/, (msg) => handleValidate(bot, msg));

// ─────────────────────────────────────────────
//  HANDLER: Pesan teks (untuk multi-step flows)
// ─────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const session = getSession(chatId);

  if (!session.action) return;

  try {
    // Coba semua handler step secara berurutan
    const handled =
      (await handleQRISStep(bot, msg)) ||
      (await handleVAStep(bot, msg)) ||
      (await handleRetailStep(bot, msg)) ||
      (await handleWithdrawStep(bot, msg)) ||
      (await handleValidateStep(bot, msg));

    if (!handled) {
      // Session ada tapi tidak ada handler yang menangani
      clearSession(chatId);
    }
  } catch (err) {
    console.error("❌ Error di message handler:", err);
    await bot.sendMessage(chatId, "❌ Terjadi kesalahan. Silakan coba lagi dengan /start");
    clearSession(chatId);
  }
});

// ─────────────────────────────────────────────
//  Error handler global
// ─────────────────────────────────────────────
bot.on("polling_error", (err) => {
  console.error("❌ Polling error:", err.message);
});

bot.on("error", (err) => {
  console.error("❌ Bot error:", err.message);
});

console.log("🤖 MustikaPay Bot aktif dan berjalan...");

module.exports = bot;
