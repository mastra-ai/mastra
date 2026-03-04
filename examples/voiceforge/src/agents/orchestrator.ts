import { Agent, Workflow, Memory } from '@mastra/core';
import { whatsappAgent } from './channels/whatsapp';
import { voiceAgent } from './channels/voice';
import { webChatAgent } from './channels/webchat';
import { emailAgent } from './channels/email';
import { pgVectorStore } from '../memory/postgres';

/**
 * VoiceForge Multi-Channel Orchestrator
 * 
 * Coordena 4 agentes (WhatsApp, Voz, Web, Email) com roteamento
 * inteligente baseado em contexto, preferência do lead e horário.
 */

export const voiceForgeOrchestrator = new Agent({
  name: 'voiceforge-orchestrator',
  model: {
    provider: 'qwen',
    name: 'qwen3-coder-next',
    toolChoice: 'auto',
  },
  instructions: `
    Você é o orquestrador VoiceForge, responsável por:
    
    1. QUALIFICAR leads em tempo real (ICP scoring)
    2. ROTEAR para canal ideal baseado em:
       - Preferência histórica (RAG memory)
       - Horário (WhatsApp 8-20h, Voz após 18h)
       - Urgência (vendas quentes → voz imediato)
    3. HANDOFF para humano quando:
       - Lead score >80 (alto valor)
       - Sentimento negativo detectado
       - Solicitação explícita
    
    Mantenha contexto cross-channel via memória vetorial.
  `,
});

export const mainWorkflow = new Workflow({
  name: 'voiceforge-main',
  triggerSchema: {
    channel: { type: 'string', enum: ['whatsapp', 'voice', 'webchat', 'email'] },
    message: { type: 'string' },
    from: { type: 'string' },
    metadata: { type: 'object' },
  },
})
  .step('loadMemory', async ({ context }) => {
    const history = await pgVectorStore.search(context.from, { limit: 5 });
    return { history };
  })
  .step('qualifyLead', async ({ context, history }) => {
    const score = await voiceForgeOrchestrator.generate([
      {
        role: 'user',
        content: `
          Mensagem: ${context.message}
          Histórico: ${JSON.stringify(history)}
          
          Retorne JSON:
          {
            "score": 0-100,
            "intent": "sales|support|scheduling",
            "urgency": "low|medium|high",
            "sentiment": "positive|neutral|negative"
          }
        `,
      },
    ]);
    return JSON.parse(score.text);
  })
  .branch('routeByIntent', {
    condition: ({ qualification }) => qualification.intent,
    branches: {
      sales: new Workflow({ name: 'sales-flow' })
        .step('checkUrgency', async ({ qualification }) => {
          if (qualification.urgency === 'high' && qualification.score > 70) {
            return { channel: 'voice', action: 'call_immediately' };
          }
          return { channel: 'whatsapp', action: 'send_offer' };
        })
        .step('executeSales', async ({ channel, action, context }) => {
          if (channel === 'voice') {
            return await voiceAgent.execute({ action: 'call', phone: context.from });
          }
          return await whatsappAgent.execute({ action: 'send', to: context.from, template: 'sales_offer' });
        }),

      support: new Workflow({ name: 'support-flow' })
        .step('checkSentiment', async ({ qualification }) => {
          if (qualification.sentiment === 'negative') {
            return { handoff: true, reason: 'negative_sentiment' };
          }
          return { handoff: false };
        })
        .step('handleSupport', async ({ handoff, context }) => {
          if (handoff) {
            // Notifica humano via Slack/email
            return { status: 'transferred_to_human' };
          }
          return await webChatAgent.execute({ action: 'reply', message: context.message });
        }),

      scheduling: new Workflow({ name: 'scheduling-flow' })
        .step('checkAvailability', async () => {
          // Integração Calendly/Google Calendar
          return { slots: ['2026-03-05 14:00', '2026-03-05 16:00'] };
        })
        .step('confirmSchedule', async ({ slots, context }) => {
          return await whatsappAgent.execute({
            action: 'send',
            to: context.from,
            message: `Horários disponíveis:\n${slots.join('\n')}\n\nResponda o número para confirmar.`,
          });
        }),
    },
  })
  .step('saveInteraction', async ({ context, qualification, result }) => {
    await pgVectorStore.store({
      userId: context.from,
      channel: context.channel,
      message: context.message,
      qualification,
      response: result,
      timestamp: new Date(),
    });
  });

export const startVoiceForge = async () => {
  console.log('🚀 VoiceForge Orchestrator iniciado');
  console.log('📞 Canais ativos: WhatsApp, Voz, Web Chat, Email');
  console.log('🧠 Modelo: Qwen3-Coder-Next');
  console.log('💾 Memory: PostgreSQL + pgvector');
};
