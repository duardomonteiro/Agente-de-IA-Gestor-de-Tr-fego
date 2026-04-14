const express = require("express");
const app = express();
app.use(express.json());

// ─── CONFIGURAÇÕES ───────────────────────────────────────────────────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY     = process.env.GEMINI_API_KEY;
const SEU_CHAT_ID    = process.env.MEU_CHAT_ID; // Só você pode usar o bot

// ─── CONTEXTO DO AGENTE ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um agente especialista em tráfego pago (Meta Ads, Google Ads, TikTok Ads).
Responda sempre em português brasileiro. Seja direto e prático.
Use bullets com • ao listar recomendações. Quando sugerir ações, numere-as.

Dados atuais das campanhas:
- Investimento total: R$14.200/mês
- Receita gerada: R$58.700/mês
- ROAS médio: 4.1x
- CPA médio: R$38,40

Campanhas ativas:
• Black Friday 2025 — ROAS 5.2x — Gasto: R$4.800
• Remarketing Site — ROAS 7.1x — Gasto: R$1.200
• Prospecção Novo Público — ROAS 2.8x — Gasto: R$5.400
• Branding Awareness — Pausada`;

// ─── HISTÓRICO DE CONVERSAS ───────────────────────────────────────────────────
const historico = {};

function getHistorico(chatId) {
  if (!historico[chatId]) historico[chatId] = [];
  return historico[chatId];
}

function addMensagem(chatId, role, content) {
  const hist = getHistorico(chatId);
  hist.push({ role, content });
  if (hist.length > 20) hist.splice(0, hist.length - 20);
}

// ─── RECEBER MENSAGENS DO TELEGRAM ───────────────────────────────────────────
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body?.message;
    if (!msg || !msg.text) return;

    const chatId = String(msg.chat.id);
    const texto  = msg.text;

    // Segurança: só responde para você
    if (SEU_CHAT_ID && chatId !== SEU_CHAT_ID) {
      await enviarMensagem(chatId, "⛔ Acesso não autorizado.");
      return;
    }

    console.log(`📩 Mensagem: ${texto}`);

    // Comando /start
    if (texto === "/start") {
      await enviarMensagem(chatId, `👋 Olá! Sou seu agente de tráfego pago.\n\nPosso te ajudar com:\n• Análise de campanhas\n• Otimizações e estratégias\n• Criação de copies\n• Redução de CPA\n• Escalonamento de campanhas\n\nSeu Chat ID é: ${chatId}\n\nComo posso te ajudar?`);
      return;
    }

    // Comando /resetar
    if (texto === "/resetar") {
      historico[chatId] = [];
      await enviarMensagem(chatId, "🔄 Histórico resetado! Podemos começar uma nova conversa.");
      return;
    }

    // Envia indicador de digitação
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" })
    });

    addMensagem(chatId, "user", texto);
    const resposta = await chamarGemini(getHistorico(chatId));
    addMensagem(chatId, "assistant", resposta);

    await enviarMensagem(chatId, resposta);
    console.log(`✅ Respondido!`);

  } catch (err) {
    console.error("❌ Erro:", err.message);
  }
});

// ─── CHAMAR GEMINI ────────────────────────────────────────────────────────────
async function chamarGemini(mensagens) {
  const contents = mensagens.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.candidates[0].content.parts.map((p) => p.text || "").join("");
}

// ─── ENVIAR MENSAGEM VIA TELEGRAM ─────────────────────────────────────────────
async function enviarMensagem(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto }),
  });
}

// ─── REGISTRAR WEBHOOK ────────────────────────────────────────────────────────
async function registrarWebhook() {
  const url = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhook/${TELEGRAM_TOKEN}`
    : null;

  if (!url) {
    console.log("⚠️  RAILWAY_PUBLIC_DOMAIN não definido — webhook não registrado automaticamente.");
    return;
  }

  const res  = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${url}`);
  const data = await res.json();
  console.log("🔗 Webhook registrado:", data.ok ? "✅ sucesso" : data.description);
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "🟢 Agente de tráfego online", versao: "2.0.0" });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Agente rodando na porta ${PORT}`);
  await registrarWebhook();
});
