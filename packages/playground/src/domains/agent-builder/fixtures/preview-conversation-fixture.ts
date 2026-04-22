import type { BuilderMessage } from './conversation-fixture';

export const buildPreviewConversation = (): BuilderMessage[] => [];

export const buildPreviewReply = (input: string): BuilderMessage => ({
  id: `preview-assistant-${Date.now()}`,
  role: 'assistant',
  content: `Here's what I would say in response to: "${input.length > 80 ? input.slice(0, 80) + '…' : input}"

This is a preview. Once you publish, I'll talk to you for real with the system prompt, model and tools you've configured.`,
});
