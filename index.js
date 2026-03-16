require("dotenv").config();
const express = require("express");
const bot = require("./src/bot/bot");
const { router: webhookRouter, setBot } = require("./webhook/server");

const PORT = process.env.PORT || 3000;
const app = express();

// Inisialisasi bot ke webhook handler
setBot(bot);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/webhook", webhookRouter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "MustikaPay Bot",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server webhook berjalan di port ${PORT}`);
  console.log(`📡 Webhook URL: ${process.env.WEBHOOK_URL || `http://localhost:${PORT}/webhook/mustika`}`);
  console.log(`🤖 Telegram Bot: aktif (polling mode)`);
});
