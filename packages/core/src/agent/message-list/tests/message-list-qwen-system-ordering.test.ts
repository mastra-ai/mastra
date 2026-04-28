import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../index';
import { MessageList } from '../index';

/**
 * Tests for system message ordering fix.
 *
 * Some providers (Qwen, certain OpenAI-compatible APIs) require that all system
 * messages appear at the very beginning of the message array. When Memory or
 * Workspace features are enabled, system messages from DB can appear mid-array,
 * causing provider errors like "System message must be at the beginning."
 *
 * @see https://github.com/mastra-ai/mastra/issues/15764
 * @see https://github.com/mastra-ai/mastra/issues/14384
 */
describe('MessageList - System Message Ordering (Qwen/OpenAI-compat)', () => {
  describe('aiV5.prompt() - system messages must be at the start', () => {
    it('should hoist db-stored system messages to the front', () => {
      const list = new MessageList();

      // Simulate a thread that has a historical system message stored in DB
      // (e.g. from Memory working memory that was persisted)
      const dbMessages: MastraDBMessage[] = [
        {
          id: 'sys-1',
          role: 'system',
          createdAt: new Date('2024-01-01'),
          content: { format: 2, parts: [{ type: 'text', text: 'You are a helpful assistant.' }] },
          threadId: 't1',
          resourceId: 'r1',
        },
        {
          id: 'user-1',
          role: 'user',
          createdAt: new Date('2024-01-02'),
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          threadId: 't1',
          resourceId: 'r1',
        },
        {
          id: 'asst-1',
          role: 'assistant',
          createdAt: new Date('2024-01-03'),
          content: { format: 2, parts: [{ type: 'text', text: 'Hi!' }] },
          threadId: 't1',
          resourceId: 'r1',
        },
        {
          id: 'sys-2',
          role: 'system',
          createdAt: new Date('2024-01-04'),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Working memory: user name is Alice.' }],
          },
          threadId: 't1',
          resourceId: 'r1',
        },
        {
          id: 'user-2',
          role: 'user',
          createdAt: new Date('2024-01-05'),
          content: { format: 2, parts: [{ type: 'text', text: 'What is my name?' }] },
          threadId: 't1',
          resourceId: 'r1',
        },
      ];

      list.add(dbMessages, 'memory');
      // Current user input
      list.add({ role: 'user', content: 'One more question.' }, 'input');
      // Workspace adds a tagged system message
      list.addSystem({ role: 'system', content: 'Workspace: /data is your filesystem root.' });

      const prompt = list.get.all.aiV5.prompt();

      // All system messages must come before any non-system message
      let seenNonSystem = false;
      for (const msg of prompt) {
        if (msg.role !== 'system') {
          seenNonSystem = true;
        } else if (seenNonSystem) {
          throw new Error(
            `System message found after non-system message: ${JSON.stringify(msg)}`,
          );
        }
      }
    });

    it('should not change order when system messages are already at the start', () => {
      const list = new MessageList();
      list.addSystem({ role: 'system', content: 'You are a helpful assistant.' });
      list.add({ role: 'user', content: 'Hello' }, 'input');
      list.add({ role: 'assistant', content: 'Hi!' }, 'response');
      list.add({ role: 'user', content: 'Next question.' }, 'input');

      const prompt = list.get.all.aiV5.prompt();
      expect(prompt[0]?.role).toBe('system');
      // No system message after first non-system
      let seenNonSystem = false;
      for (const msg of prompt) {
        if (msg.role !== 'system') {
          seenNonSystem = true;
        } else {
          expect(seenNonSystem).toBe(false);
        }
      }
    });
  });

  describe('aiV4.prompt() - system messages must be at the start', () => {
    it('should hoist out-of-order system messages when using aiV4 prompt', () => {
      const list = new MessageList();

      // DB-stored system message mid-conversation (e.g. working memory update)
      const dbMessages: MastraDBMessage[] = [
        {
          id: 'user-1',
          role: 'user',
          createdAt: new Date('2024-01-01'),
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          threadId: 't1',
          resourceId: 'r1',
        },
        {
          id: 'sys-mid',
          role: 'system',
          createdAt: new Date('2024-01-02'),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Memory update: user prefers TypeScript.' }],
          },
          threadId: 't1',
          resourceId: 'r1',
        },
        {
          id: 'user-2',
          role: 'user',
          createdAt: new Date('2024-01-03'),
          content: { format: 2, parts: [{ type: 'text', text: 'What language should I use?' }] },
          threadId: 't1',
          resourceId: 'r1',
        },
      ];

      list.add(dbMessages, 'memory');
      list.add({ role: 'user', content: 'New question.' }, 'input');

      const prompt = list.get.all.aiV4.prompt();

      let seenNonSystem = false;
      for (const msg of prompt) {
        if (msg.role !== 'system') {
          seenNonSystem = true;
        } else if (seenNonSystem) {
          throw new Error(
            `System message found after non-system message in aiV4.prompt: ${JSON.stringify(msg)}`,
          );
        }
      }
    });
  });
});
