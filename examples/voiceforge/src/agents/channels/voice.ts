import { Agent } from '@mastra/core';
import { twilio } from '../../integrations/twilio';

/**
 * Voice Agent - Twilio Integration
 * 
 * Funcionalidades:
 * - Chamadas outbound para leads quentes
 * - Receber chamadas inbound
 * - Transcrição tempo-real (Deepgram)
 * - TTS natural (ElevenLabs)
 */

export const voiceAgent = new Agent({
  name: 'voice-agent',
  model: {
    provider: 'qwen',
    name: 'qwen3-coder-next',
  },
  instructions: `
    Você é uma SDR de vendas por telefone, especializada em:
    
    OBJETIVOS:
    1. Qualificar lead em <2min (ICP, orçamento, urgência)
    2. Agendar demo/consulta (Calendly link via SMS)
    3. Handoff para vendedor se score >80
    
    SCRIPT BASE:
    - Intro: "Olá {nome}, aqui é a assistente da {empresa}. Vi seu interesse em {produto}. Tem 2min?"
    - Qualificação: "Para personalizar, qual seu principal desafio com {pain_point}?"
    - Fechamento: "Perfeito! Vou enviar link para agendar. Horários preferidos?"
    
    TOM:
    - Energético mas não agressivo
    - Escuta ativa (pausas 2s)
    - Objeções: empatia + reframe
  `,
});

export const voiceTools = {
  makeCall: async ({ to, script }: { to: string; script: string }) => {
    return await twilio.calls.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      twiml: `<Response><Say voice="Polly.Camila">${script}</Say></Response>`,
    });
  },

  handleIncoming: async ({ callSid, from }: { callSid: string; from: string }) => {
    // Webhook Twilio → transcrição Deepgram → resposta agent
    return {
      twiml: `<Response><Gather input="speech" action="/api/voice/process"><Say>Olá! Como posso ajudar?</Say></Gather></Response>`,
    };
  },

  sendSMS: async ({ to, message }: { to: string; message: string }) => {
    return await twilio.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: message,
    });
  },
};
