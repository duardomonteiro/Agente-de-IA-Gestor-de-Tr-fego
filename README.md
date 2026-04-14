# 🤖 Agente de Tráfego Pago — WhatsApp + Claude

## Pré-requisitos
- Conta no [Railway](https://railway.app) (gratuito para começar)
- Chave da API Anthropic: [console.anthropic.com](https://console.anthropic.com)
- App Meta configurado com WhatsApp Business API

---

## 🚀 Deploy no Railway (passo a passo)

### 1. Criar projeto no Railway
1. Acesse railway.app e faça login com GitHub
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Suba esses arquivos num repositório GitHub (ou use **"Empty Project"** + drag & drop)

### 2. Adicionar variáveis de ambiente
No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `WHATSAPP_TOKEN` | Seu token do Meta (renovar a cada 24h ou gerar permanente) |
| `PHONE_NUMBER_ID` | `923257477148115` |
| `ANTHROPIC_API_KEY` | Sua chave em console.anthropic.com |
| `VERIFY_TOKEN` | `agente_trafego_2025` |

### 3. Pegar a URL do Railway
Após o deploy, o Railway gera uma URL tipo:
```
https://whatsapp-agente-trafego-production.up.railway.app
```

---

## 📱 Configurar Webhook no Meta

1. No painel Meta Developers, vá em **WhatsApp → Configuração**
2. Em **Webhook**, clique em **Editar**
3. Cole a URL:
   ```
   https://SUA-URL.railway.app/webhook
   ```
4. No campo **Verify Token**, digite: `agente_trafego_2025`
5. Clique em **Verificar e salvar**
6. Ative a assinatura **messages**

---

## ✅ Testar

Mande uma mensagem para o número do WhatsApp Business e o agente deve responder!

Exemplos de perguntas para testar:
- "Qual campanha está com melhor ROAS?"
- "Como posso reduzir meu CPA?"
- "Devo pausar alguma campanha?"

---

## ⚠️ Token permanente (importante!)

O token atual expira em ~24h. Para gerar um permanente:
1. No Meta Business Suite, vá em **Configurações do negócio**
2. **Usuários do sistema** → Crie um usuário do sistema Admin
3. Gere um token com permissão `whatsapp_business_messaging`
4. Substitua no Railway em Variables
