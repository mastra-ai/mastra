import { Agent } from '@mastra/core';
import { baileys } from '../../integrations/baileys';

/**
 * WhatsApp Agent - Baileys Integration
 * 
 * Responsável por:
 * - Receber mensagens WhatsApp Business
 * - Enviar respostas formatadas
 * - Templates para vendas/agendamento
 */

export const whatsappAgent = new Agent({
  name: 'whatsapp-agent',
  model: {
    provider: 'qwen',
    name: 'qwen3-coder-next',
  },
  instructions: `
    Você é um assistente de vendas via WhatsApp, especializado em:
    
    ESTILO:
    - Mensagens curtas (max 2 linhas)
    - Emojis moderados (1-2 por msg)
    - Tom amigável mas profissional
    - Perguntas abertas para qualificar
    
    NUNCA:
    - Enviar links sem contexto
    - Mensagens genéricas copy-paste
    - Respostas longas (>3 parágrafos)
    
    TEMPLATES:
    - Saudação: "Oi {nome}! 👋 Como posso ajudar?"
    - Agendamento: "Perfeito! Temos horários às {slots}. Qual prefere?"
    - Objeção: "Entendo sua preocupação. Posso explicar melhor sobre {topic}?"
  `,
});

export const whatsappTools = {
  sendMessage: async ({ to, message }: { to: string; message: string }) => {
    return await baileys.sendMessage(to, { text: message });
  },

  sendTemplate: async ({ to, template, variables }: { to: string; template: string; variables: Record<string, string> }) => {
    const templates = {
      sales_offer: `Oi {{nome}}! 🎉\n\nTenho uma oferta especial: {{offer}}\n\nInteresse? Responda SIM para detalhes.`,
      scheduling_confirm: `Agendado! ✅\n\n📅 {{date}}\n🕐 {{time}}\n📍 {{location}}\n\nEnviaremos lembrete 1h antes.`,
      followup: `Oi {{nome}}! Notei que visitou {{page}}.\n\nPosso tirar dúvidas? 😊`,
    };

    let msg = templates[template as keyof typeof templates] || message;
    Object.entries(variables).forEach(([key, val]) => {
      msg = msg.replace(`{{${key}}}`, val);
    });

    return await baileys.sendMessage(to, { text: msg });
  },

  sendMedia: async ({ to, url, caption }: { to: string; url: string; caption?: string }) => {
    return await baileys.sendMessage(to, { image: { url }, caption });
  },
};
