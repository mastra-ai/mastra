import type { MastraDBMessage } from '@mastra/client-js';
import type { AvailableModelOption, ModelCredentialHolder } from '../../../../../../hooks/useAvailableModels';

export const runErrorModels: AvailableModelOption[] = [
  { id: 'openai/gpt-5', provider: 'openai', modelName: 'GPT-5', hasApiKey: true, credentialHolder: 'personal' },
  {
    id: 'anthropic/claude-sonnet-4-6',
    provider: 'anthropic',
    modelName: 'Claude Sonnet 4.6',
    hasApiKey: true,
    credentialHolder: 'personal',
  },
];

export function modelsWithCredentialHolder(credentialHolder: ModelCredentialHolder): AvailableModelOption[] {
  return runErrorModels.map(model => ({ ...model, credentialHolder }));
}

export function failedReply(message = 'Bad Request', name = 'AI_APICallError'): MastraDBMessage {
  return {
    id: 'failed-reply',
    role: 'assistant',
    createdAt: new Date('2026-10-19T10:00:00Z'),
    content: { format: 2, parts: [{ type: 'error', error: { name, message } }] },
  };
}

export const nextUserMessage: MastraDBMessage = {
  id: 'next-user-message',
  role: 'user',
  createdAt: new Date('2026-10-19T10:01:00Z'),
  content: { format: 2, parts: [{ type: 'text', text: 'A new request' }] },
};
