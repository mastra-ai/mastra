import { describe, expect, it, vi } from 'vitest';
import { conversationHistory, resolveSearchQuery } from '../../src/mastra/answers/query-context.js';

describe('query history boundaries', () => {
  it('uses only bounded conversational messages before the latest question', () => {
    const messages = [
      ...Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 ? 'assistant' : 'user',
        content: String(i) + 'x'.repeat(3_000),
      })),
      { role: 'system', content: 'private system prompt' },
      { role: 'tool', content: 'private tool payload' },
      { role: 'signal', type: 'approval', content: 'private approval' },
      { role: 'signal', type: 'user', content: 'Current question' },
    ];
    const history = conversationHistory(messages);
    expect(history.length).toBeLessThanOrEqual(6);
    expect(history.reduce((total, message) => total + message.content.length, 0)).toBeLessThanOrEqual(6_000);
    expect(history.every(message => message.content.length <= 2_000)).toBe(true);
    expect(JSON.stringify(history)).not.toMatch(/private|Current question/);
    expect(history.at(-1)?.content).toMatch(/^19/);
  });

  it('preserves cancellation instead of starting a fallback search', async () => {
    const controller = new AbortController();
    controller.abort(new Error('Cancelled request'));
    const contextualize = vi.fn().mockRejectedValue(new Error('aborted'));
    await expect(
      resolveSearchQuery(
        'And then?',
        [{ role: 'user', content: 'Earlier question' }],
        contextualize,
        controller.signal,
      ),
    ).rejects.toThrow('Cancelled request');
  });
});
