# VoiceForge - Multi-Channel AI Agent SaaS

![VoiceForge Banner](https://img.shields.io/badge/Mastra-VoiceForge-7C3AED?style=for-the-badge)
![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square)

**VoiceForge** é um SaaS completo de agentes de IA multi-canal (WhatsApp, Voz, Web Chat, Email) voltado para PMEs brasileiras. Automatiza vendas, suporte e agendamentos 24/7 usando o framework [Mastra](https://mastra.ai).

## 🎯 Problema & Solução

**Problema**: PMEs perdem 70% dos leads por atendimento lento fora do horário comercial. Call centers custam R$25-40/hora.

**Solução**: Agentes IA que operam 24/7 em múltiplos canais, qualificam leads em <2min, e custam R$0,22/conversa.

## ✨ Funcionalidades

### Core Features
- 📱 **WhatsApp Nativo**: Responde <1min via Baileys API, templates personalizados
- 📞 **Voz Humanizada**: Twilio + TTS (ElevenLabs), liga para leads quentes
- 🌐 **Web Chat**: Widget embed com UI customizável
- 📧 **Email Auto**: Follow-ups inteligentes via Resend
- 🧠 **Memória RAG**: PostgreSQL + pgvector, contexto cross-channel
- 🔄 **Human Handoff**: Transferência automática para casos complexos
- 📈 **Analytics Real-Time**: Dashboard com métricas ROI/conversão

### Dashboard Admin
- 📊 Métricas ao vivo (leads, agendamentos, receita)
- 💬 Lista de conversas com threads WhatsApp/voz
- 🤖 Config agents (modelo LLM, temperature, prompts)
- 🔊 Gráficos (line chart horários, pie chart canais)
- 🎮 Pause/play agents individuais

## 💼 Use Cases por Vertical

| Vertical | Problema | Solução VoiceForge | ROI Esperado |
|----------|----------|--------------------|--------------|
| **Clínicas** | 60% ligações perdidas | Agendamento auto + lembretes | +340% |
| **Imobiliárias** | Follow-up lento | Voz liga em 5min, agenda visita | +280% |
| **E-commerce** | Carrinho abandonado | WhatsApp oferece desconto | -50% churn |

## 🏗️ Arquitetura

```typescript
// Orquestrador multi-agent
export const voiceForgeOrchestrator = createMultiAgent({
  planner: { model: 'qwen/qwen3-coder-next' },
  agents: {
    whatsapp: whatsappAgent,  // Baileys
    voice: voiceAgent,        // Twilio
    webchat: webChatAgent,    // Socket.io
    email: emailAgent,        // Resend
  },
  workflow: workflow()
    .parallel('listenAllChannels')      // Escuta 4 canais simultâneo
    .then('qualifyLead')                 // RAG + ICP scoring
    .branch('routeByIntent', {           // Roteamento inteligente
      sales: 'salesFlow',
      support: 'supportFlow',
      scheduling: 'calendarFlow',
    })
    .humanInLoop('complexCase'),         // Handoff >80 score
  memory: pgVectorStore,                 // PostgreSQL + pgvector
});
```

### Tech Stack
**Backend**
- Framework: [Mastra](https://mastra.ai) (multi-agent orchestration)
- Runtime: Node.js 18+
- LLM: Qwen3-Coder-Next (optimized cost/performance)
- Database: PostgreSQL 15 + pgvector
- Channels: Baileys (WhatsApp), Twilio (Voice), Resend (Email)

**Frontend**
- Framework: Next.js 14 (App Router)
- UI: Tailwind CSS + ShadCN
- Charts: Recharts
- Animations: Framer Motion
- Icons: Lucide React

**Infra**
- Deploy: Docker + Traefik
- Hosting: VPS (Contabo/Hetzner) ou Vercel
- Observability: Mastra Cloud

## 🚀 Quick Start

### 1. Instalação
```bash
git clone https://github.com/OARANHA/mastra
cd mastra/examples/voiceforge
npm install
cp .env.example .env.local
```

### 2. Configurar Variáveis
```env
# .env.local
DATABASE_URL=postgresql://user:pass@localhost:5432/voiceforge

# LLM (escolha 1)
QWEN_API_KEY=sk-xxxxxxxx
GLM_API_KEY=glm-xxxxxxxx

# Canais
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+5511999999999

WHATSAPP_INSTANCE_ID=xxxxxxxx
WHATSAPP_API_KEY=xxxxxxxx

RESEND_API_KEY=re_xxxxxxxx
```

### 3. Database Setup
```bash
docker-compose up -d  # PostgreSQL + pgvector
npm run db:migrate
npm run db:seed       # Dados mock para testes
```

### 4. Rodar MVP
```bash
npm run dev
# Landing: http://localhost:3000
# Dashboard: http://localhost:3000/dashboard
```

### 5. Testar Agents
```bash
# WhatsApp webhook
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{"from": "+5511999999999", "message": "Quero agendar consulta"}'

# Voice incoming call
curl -X POST http://localhost:3000/api/voice/incoming \
  -d "From=%2B5511999999999"
```

## 💰 Modelo de Negócio

### Pricing Sugerido
| Plano | Preço | Conversas | Canais | White Label |
|-------|--------|-----------|--------|-------------|
| **Starter** | R$97/mês | 500 | 1 | ❌ |
| **Pro** | R$297/mês | 5.000 | 4 | ❌ |
| **Enterprise** | R$997/mês | Ilimitado | 4 | ✅ |

### Custos Operacionais
- **WhatsApp**: R$0,15/conversa (Baileys API)
- **Voz**: R$0,05/min (Twilio)
- **LLM**: R$0,02/conversa (Qwen)
- **Total**: ~R$0,22/lead → **Margem 75%+**

### Projeção Financeira (Conservadora)
| Métrica | Mês 1 | Mês 6 | Ano 1 |
|---------|-------|-------|-------|
| Clientes | 10 | 120 | 500 |
| MRR | R$2,9k | R$35k | R$148k |
| ARR | - | R$420k | **R$1,78M** |
| Churn | 15% | 8% | 5% |

**Aquisição**: Meta Ads R$5 CPA, 100 trials/mês → 30% conversão.

## 🎨 Design System

### Paleta de Cores
```css
--primary: #7C3AED;      /* Roxo - inovação IA */
--secondary: #10B981;    /* Verde - conversões/sucesso */
--dark: #1F2937;         /* Cinza escuro - backgrounds */
--accent-warn: #FBBF24;  /* Amarelo - alertas */
--accent-error: #EF4444; /* Vermelho - erros críticos */
```

### Componentes Principais
**Landing Page**
- Hero gradient animado (Framer Motion)
- Features grid 4x2 com hover scale
- Social proof testemunhos (3 verticais)
- Pricing cards com "Mais Vendido" highlight
- Demo interativo (chat funcional)

**Dashboard**
- Sidebar nav (Dashboard/Conversas/Agents/Analytics)
- Metrics cards (4 KPIs principais)
- Line chart (conversas por horário)
- Pie chart (distribuição canais)
- Conversation threads (WhatsApp/voz com play)
- Agent config (Monaco editor para prompts)

## 📦 Deploy Produção

### Opção 1: VPS com Docker
```bash
# docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d

# Traefik reverse proxy com SSL auto
# Portainer para UI management
```

### Opção 2: Vercel (Frontend) + Railway (Backend)
```bash
# Frontend
vercel --prod

# Backend agents
railway up
```

### Domínio & SSL
- Registre: `voiceforge.ai` ou `voiceforge.com.br`
- Cloudflare DNS + proxy
- SSL automático via Let's Encrypt/Traefik

## 📈 Roadmap

### V1.0 (MVP - 7 dias) ✅
- [x] WhatsApp + Voice agents core
- [x] Dashboard analytics
- [x] Landing page completa
- [x] Pricing + testimonials

### V1.1 (Mês 1)
- [ ] Web chat widget embed
- [ ] Email automation flows
- [ ] Stripe billing integration
- [ ] Webhooks para CRMs (HubSpot, RD Station)

### V2.0 (Mês 3)
- [ ] White label portal
- [ ] Multi-tenancy
- [ ] Mobile app (React Native)
- [ ] API pública + docs

### V3.0 (Mês 6)
- [ ] Marketplace de verticais (templates)
- [ ] A/B testing prompts
- [ ] Sentiment analysis real-time
- [ ] Voice cloning (custom TTS)

## 🎯 Target Market

**Brasil**: 20M PMEs, 85% sem automação, mercado R$2B/ano em call centers.

**Verticais Prioritárias**:
1. 🦷 Clínicas/Dentistas (150k+ Brasil)
2. 🏠 Imobiliárias (80k+ corretores)
3. 🛍️ E-commerce (1,5M lojas)
4. 💇 Salões/Barbearias (200k+)
5. 🏋️ Academias (35k+)

## 🤝 Contribuindo

PRs bem-vindos! Áreas prioritárias:
- 🔌 Novos canais (Telegram, Instagram DM, SMS)
- 🏭 Verticais (Academias, Restaurantes, Advogados)
- 🔗 Integrações (Calendly, Stripe, Notion, Linear)
- 🌎 i18n (inglês, espanhol, francês)
- 🧪 Testes unitários (coverage >80%)

### Setup Dev
```bash
git checkout -b feature/sua-feature
npm run dev
npm run test
npm run lint
git commit -m "feat: adiciona X"
```

## 📄 Licença

Apache 2.0 - **Use comercialmente, fork à vontade**.

Você pode:
- ✅ Vender como SaaS
- ✅ White label para clientes
- ✅ Modificar código
- ✅ Uso privado em empresa

Deve:
- 📝 Manter aviso de copyright
- 📝 Documentar mudanças significativas

## 🔗 Links

- [Mastra Docs](https://mastra.ai/docs)
- [Demo Live](https://voiceforge-demo.vercel.app)
- [Figma Design System](https://figma.com/@voiceforge)
- [Discord Community](https://discord.gg/voiceforge)
- [YouTube Tutorials](https://youtube.com/@voiceforge)

## 👨‍💻 Autor

Criado por [A.Aranha](https://github.com/OARANHA)

**Suporte**:
- 📧 Email: aranha@ulbra.edu.br
- 🐛 Issues: [GitHub Issues](https://github.com/OARANHA/mastra/issues)
- 💬 Discord: [VoiceForge Server](https://discord.gg/voiceforge)

---

<div align="center">

**⭐ Se este projeto ajudou, deixe uma estrela!**

**Construído com ❤️ usando [Mastra AI Framework](https://mastra.ai)**

![Mastra](https://img.shields.io/badge/Powered%20by-Mastra-7C3AED?style=for-the-badge)

</div>
