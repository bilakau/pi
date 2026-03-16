const axios = require("axios");
const qs = require("qs");
require("dotenv").config();

const BASE_URL = process.env.MUSTIKA_BASE_URL || "https://mustikapayment.com";
const API_KEY = process.env.MUSTIKA_API_KEY;

// Buat instance axios dengan header default
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "X-Api-Key": API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  timeout: 30000,
});

// ─────────────────────────────────────────────
//  HELPER: Format Rupiah
// ─────────────────────────────────────────────
function formatRupiah(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─────────────────────────────────────────────
//  1. CREATE QRIS
// ─────────────────────────────────────────────
async function createQRIS({ amount, product_name, customer_name, customer_email, redirect_url } = {}) {
  const payload = { amount };
  if (product_name) payload.product_name = product_name;
  if (customer_name) payload.customer_name = customer_name;
  if (customer_email) payload.customer_email = customer_email;
  if (redirect_url) payload.redirect_url = redirect_url;

  const res = await apiClient.post("/api/createpay", qs.stringify(payload));
  return res.data;
}

// ─────────────────────────────────────────────
//  2. CREATE VIRTUAL ACCOUNT
// ─────────────────────────────────────────────
async function createVA({ amount, bank_code, name, product_name, customer_email, phone, redirect_url } = {}) {
  const payload = { amount, bank_code, name };
  if (product_name) payload.product_name = product_name;
  if (customer_email) payload.customer_email = customer_email;
  if (phone) payload.phone = phone;
  if (redirect_url) payload.redirect_url = redirect_url;

  const res = await apiClient.post("/create/va", qs.stringify(payload));
  return res.data;
}

// ─────────────────────────────────────────────
//  3. CREATE RETAIL (Alfamart / Indomaret)
// ─────────────────────────────────────────────
async function createRetail({ amount, retail_outlet, name, product_name, customer_email } = {}) {
  const payload = { amount, retail_outlet, name };
  if (product_name) payload.product_name = product_name;
  if (customer_email) payload.customer_email = customer_email;

  const res = await apiClient.post("/create/retail", qs.stringify(payload));
  return res.data;
}

// ─────────────────────────────────────────────
//  4. CEK STATUS PEMBAYARAN (QRIS / VA)
// ─────────────────────────────────────────────
async function cekPay(ref_no) {
  const res = await apiClient.get(`/api/cekpay?ref_no=${ref_no}`);
  return res.data;
}

// ─────────────────────────────────────────────
//  5. PENARIKAN DANA (WITHDRAW)
// ─────────────────────────────────────────────
async function withdraw({ tipe, kode, rek, amount, otp } = {}) {
  const payload = { tipe, kode, rek, amount };
  if (otp) payload.otp = otp;

  const res = await apiClient.post("/api/wd", qs.stringify(payload));
  return res.data;
}

// ─────────────────────────────────────────────
//  6. CEK STATUS WITHDRAW
// ─────────────────────────────────────────────
async function cekWD(ref_no) {
  const res = await apiClient.get(`/api/cekwd?ref_no=${ref_no}`);
  return res.data;
}

// ─────────────────────────────────────────────
//  7. VALIDASI REKENING / E-WALLET
// ─────────────────────────────────────────────
async function validateRekening({ tipe, kode, rek } = {}) {
  const res = await apiClient.get(
    `/api/validate-bank?tipe=${tipe}&kode=${kode}&rek=${rek}`
  );
  return res.data;
}

// ─────────────────────────────────────────────
//  8. CEK SALDO
// ─────────────────────────────────────────────
async function cekSaldo(username) {
  const user = username || process.env.MUSTIKA_USERNAME;
  const res = await apiClient.get(`/api/saldo?user=${user}`);
  return res.data;
}

// ─────────────────────────────────────────────
//  9. DIRECT PAYMENT LINK (Generate URL)
// ─────────────────────────────────────────────
function generatePaymentLink({ username, amount, order_id, redirect } = {}) {
  const user = username || process.env.MUSTIKA_USERNAME;
  let url = `${BASE_URL}/pay/${user}/${amount}`;
  const params = [];
  if (order_id) params.push(`order_id=${encodeURIComponent(order_id)}`);
  if (redirect) params.push(`redirect=${encodeURIComponent(redirect)}`);
  if (params.length) url += `?${params.join("&")}`;
  return url;
}

module.exports = {
  createQRIS,
  createVA,
  createRetail,
  cekPay,
  withdraw,
  cekWD,
  validateRekening,
  cekSaldo,
  generatePaymentLink,
  formatRupiah,
};
