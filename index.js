const express = require("express");
const app = express();
app.use(express.json());

// ─── CONFIGURAÇÕES ───────────────────────────────────────────────────────────
const WHATSAPP_TOKEN   = process.env.WHATSAPP_TOKEN;   // Token do Meta
const PHONE_NUMBER_ID  = process.env.PHONE_NUMBER_ID;  // 923257477148115
const GEMINI_KEY       = process.env.GEMINI_API_KEY;
const VERIFY_TOKEN     = process.env.VERIFY_TOKEN || "agente_trafego_2025";

// ─── CONTEXTO DO AGENTE ───────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um agente especialista em tráfego pago (Meta Ads, Google Ads, TikTok Ads).
Você está respondendo via WhatsApp, então seja objetivo e use formatação simples (sem markdown pesado).
Use bullets com • ao invés de -.

Dados atuais das campanhas (atualize quando receber dados reais da API):
- Investimento total: R$14.200/mês
- Receita gerada: R$58.700/mês
- ROAS médio: 4.1x
- CPA médio: R$38,40

Campanhas ativas:
• Black Friday 2025 — ROAS 5.2x — Gasto: R$4.800
• Remarketing Site — ROAS 7.1x — Gasto: R$1.200
• Prospecção Novo Público — ROAS 2.8x — Gasto: R$5.400
• Branding Awareness — Pausada

Responda sempre em português brasileiro. Seja direto e prático.
Quando sugerir ações, numere-as claramente.`;

// ─── HISTÓRICO DE CONVERSAS (em memória, por número de telefone) ─────────────
const historico = {};

function getHistorico(phone) {
  if (!historico[phone]) historico[phone] = [];
  return historico[phone];
}

function addMensagem(phone, role, content) {
  const hist = getHistorico(phone);
  hist.push({ role, content });
  // Mantém apenas as últimas 20 mensagens para não explodir o contexto
  if (hist.length > 20) hist.splice(0, hist.length - 20);
}

// ─── WEBHOOK VERIFICATION (GET) ──────────────────────────────────────────────
app.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado com sucesso!");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ─── RECEBER MENSAGENS (POST) ────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Responde imediatamente pro Meta não reenviar

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== "text") return;

    const phone   = message.from;
    const texto   = message.text.body;

    console.log(`📩 Mensagem de ${phone}: ${texto}`);

    // Adiciona mensagem do usuário ao histórico
    addMensagem(phone, "user", texto);

    // Chama Claude com histórico completo
    const resposta = await chamarClaude(getHistorico(phone));

    // Adiciona resposta ao histórico
    addMensagem(phone, "assistant", resposta);

    // Envia resposta via WhatsApp
    await enviarMensagem(phone, resposta);

    console.log(`✅ Respondido para ${phone}`);
  } catch (err) {
    console.error("❌ Erro no webhook:", err.message);
  }
});

// ─── CHAMAR GEMINI ────────────────────────────────────────────────────────────
async function chamarClaude(mensagens) {
  // Converte histórico para formato Gemini
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

// ─── ENVIAR MENSAGEM VIA WHATSAPP ─────────────────────────────────────────────
async function enviarMensagem(para, texto) {
  await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "text",
        text: { body: texto },
      }),
    }
  );
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "🟢 Agente de tráfego online", versao: "1.0.0" });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Agente rodando na porta ${PORT}`);
});
