import { MessageList } from '@mastra/core/agent/message-list';
import { RegexFilterProcessor } from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { ProcessingFailure } from './failure.ts';

export async function checkLocalContent(text: string, id: string) {
  const messages: MastraDBMessage[] = [
    { id, role: 'user', createdAt: new Date(), content: { format: 2, parts: [{ type: 'text', text }] } },
  ];
  const regex = new RegexFilterProcessor({
    presets: ['secrets', 'pii'],
    strategy: 'block',
    includeRedactedValues: false,
    rules: [
      { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
      { name: 'openai-key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
    ],
  });
  try {
    await regex.processInput({
      messages,
      messageList: new MessageList(),
      systemMessages: [],
      state: {},
      retryCount: 0,
      abort: () => {
        throw new ProcessingFailure('SECURITY_BLOCKED');
      },
    });
  } catch {
    throw new ProcessingFailure('SECURITY_BLOCKED');
  }
}
