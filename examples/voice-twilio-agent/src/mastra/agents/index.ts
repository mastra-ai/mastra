import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

/**
 * Phone Agent - An AI assistant that handles phone calls
 *
 * This agent is designed for voice interactions over phone calls.
 * It uses Twilio Media Streams for audio transport and can integrate
 * with various AI providers for speech-to-speech capabilities.
 */
export const phoneAgent = new Agent({
  id: 'phone-agent',
  name: 'Phone Agent',
  instructions: `You are a helpful phone assistant. You help callers with their questions and requests.

Guidelines:
- Speak naturally and conversationally
- Keep responses concise since this is a phone call
- Ask clarifying questions if needed
- Be polite and professional
- If you don't know something, say so honestly

Remember: You're speaking to someone on a phone call, so be mindful of audio-only communication.`,
  model: openai('gpt-4o'),
});
