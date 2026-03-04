# VoiceForge - Multi-Channel AI Agent SaaS

![VoiceForge Banner](https://img.shields.io/badge/Mastra-VoiceForge-7C3AED?style=for-the-badge)

**VoiceForge** é um template SaaS completo para criar agentes de IA multi-canal (WhatsApp, Voz, Web Chat, Email) voltado para PMEs brasileiras. Construído com Mastra, permite automação de vendas, suporte e agendamentos 24/7.

## 🚀 Funcionalidades

- **4 Canais Integrados**: WhatsApp (Baileys), Voz (Twilio), Web Chat, Email
- **Orquestração Inteligente**: Roteamento automático baseado em preferência/contexto
- **Vertical Templates**: Clínicas, Imobiliárias, E-commerce
- **Human Handoff**: Transferência para humanos em casos complexos
- **Analytics Real-Time**: Dashboard com métricas de conversão
- **RAG Personalizado**: PostgreSQL + pgvector para histórico cliente

## 📊 Use Cases

| Vertical | Problema | Solução VoiceForge |
|----------|----------|--------------------|
| Clínicas | 60% ligações perdidas fora horário | Agent agenda + confirma consultas via WhatsApp |
| Imobiliárias | Leads frios por follow-up lento | Voz liga em 5min, qualifica e agenda visita |
| E-commerce | Churn alto em carrinho abandonado | Chat oferece desconto + WhatsApp follow-up |

## 🏗️ Arquitetura

```typescript
// Core orchestrator
export const voiceForgeOrchestrator = createMultiAgent({
  planner: { model: 'qwen/qwen3-coder-next' },
  agents: {
    whatsapp: whatsappAgent,
    voice: voiceAgent,
    webchat: webChatAgent,
    email: emailAgent,
  },
  workflow: workflow()
    .parallel('listenAllChannels')
    .then('qualifyLead')
    .branch('routeByIntent', {
      sales: 'salesFlow',
      support: 'supportFlow',
      scheduling: 'calendarFlow',
    })
    .humanInLoop('complexCase'),
  memory: pgVectorStore,
});
```

## 💰 Modelo de Negócio

### Pricing Sugerido
- **Starter** (R$97/mês): 1 canal, 500 conversas, 1 vertical
- **Pro** (R$297/mês): 4 canais, 5k conversas, 3 verticais, analytics
- **Enterprise** (R$997/mês): Ilimitado + white label + API custom

### Custos Operacionais
- WhatsApp: R$0,15/conversa (Baileys API)
- Voz: R$0,05/min (Twilio)
- LLM: R$0,02/conversa (Qwen optimized)
- **Total**: R$0,22/lead → Margem 75%+

## 🎨 Design System

### Paleta de Cores
```css
--primary: #7C3AED;      /* Roxo vibrante - inovação */
--secondary: #10B981;    /* Verde - conversões */
--dark: #1F2937;         /* Cinza escuro - backgrounds */
--accent-warn: #FBBF24;  /* Amarelo - alerts */
--accent-error: #EF4444; /* Vermelho - críticos */
```

### Componentes UI
- **Landing**: Gradient hero, animated features grid, interactive demo
- **Dashboard**: Sidebar navigation, real-time metrics cards, conversation threads
- **Admin**: Agent config, prompt editor (Monaco), channel toggles

### Tech Stack Frontend
- Next.js 14 (App Router)
- Tailwind CSS + ShadCN UI
- Framer Motion (animations)
- Recharts (analytics)
- Lucide Icons

## 🚦 Quick Start

### 1. Instalação
```bash
npm install
cp .env.example .env.local
```

### 2. Configurar Variáveis
```env
DATABASE_URL=postgresql://...
QWEN_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
WHATSAPP_INSTANCE_ID=...
```

### 3. Deploy
```bash
docker-compose up -d
npm run db:migrate
npm run dev
```

### 4. Testar Agents
```bash
# WhatsApp
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -d '{"message": "Quero agendar consulta"}'

# Voice
curl -X POST http://localhost:3000/api/voice/incoming \
  -d '{"From": "+5511999999999"}'
```

## 📈 Roadmap

- [x] WhatsApp + Voice core agents
- [x] Dashboard analytics
- [ ] Web chat widget embed
- [ ] Email automation flows
- [ ] White label portal
- [ ] Stripe billing integration
- [ ] Multi-tenancy support
- [ ] Mobile app (React Native)

## 🎯 Target Market

**Brasil**: 20M PMEs, 85% sem automação, mercado R$2B/ano em call centers.

**Verticais Prioritárias**:
1. Clínicas/Dentistas (150k+ Brasil)
2. Imobiliárias (80k+ corretores)
3. E-commerce (1,5M lojas)

## 📊 Projeção Financeira

| Métrica | Mês 1 | Mês 6 | Ano 1 |
|---------|-------|-------|-------|
| Clientes | 10 | 120 | 500 |
| MRR | R$2,9k | R$35k | R$148k |
| ARR | - | R$420k | R$1,78M |
| Churn | 15% | 8% | 5% |

**Aquisição**: Meta Ads R$5 CPA, 100 trials/mês → 30% conversão.

## 🤝 Contribuindo

PRs bem-vindos! Áreas prioritárias:
- Novos canais (Telegram, Instagram DM)
- Verticais (Academias, Restaurantes)
- Integrações (Stripe, HubSpot, RD Station)
- i18n (inglês, espanhol)

## 📄 Licença

Apache 2.0 - Use comercialmente, fork à vontade.

## 🔗 Links

- [Mastra Docs](https://mastra.ai/docs)
- [Demo VoiceForge](https://voiceforge-demo.vercel.app)
- [Figma Design System](https://figma.com/@voiceforge)

---

**Construído com ❤️ usando Mastra AI Framework**
