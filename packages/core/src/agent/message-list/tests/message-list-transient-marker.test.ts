import { describe, expect, it } from 'vitest';
import { createSignal } from '../../signals';
import { MessageList } from '../index';

// Follow-up to #22060: a transient signal is delivery-only and never persisted, so a consumer
// placing prompt-cache breakpoints must keep them behind these rows. convertSignalForModelPrompt
// marks the projected parts; the aiV5 prompt conversion surfaces that as
// `providerOptions.mastra.transient` on the outbound message, which is how consumers identify the
// row without pattern-matching the rendered `<system-reminder>` tag (that would also catch
// reminders that ARE persisted).

type OutboundTextPart = { type: string; providerOptions?: { mastra?: { transient?: boolean } } };

function lastPromptParts(prompt: Awaited<ReturnType<MessageList['get']['all']['aiV5']['prompt']>>): OutboundTextPart[] {
  const last = prompt.at(-1);
  return Array.isArray(last?.content) ? (last!.content as OutboundTextPart[]) : [];
}

describe('transient signal outbound cache marker', () => {
  it('marks a transient signal on the outbound prompt as providerOptions.mastra.transient', async () => {
    const list = new MessageList();
    list.add('hello', 'input');
    list.addSignal(createSignal({ type: 'reactive', contents: 'Stay on the current task.', transient: true }));

    const parts = lastPromptParts(await list.get.all.aiV5.prompt());
    const textPart = parts.find(p => p.type === 'text');

    expect(textPart).toBeDefined();
    expect(textPart?.providerOptions?.mastra?.transient).toBe(true);
  });

  it('does not mark a non-transient reminder (so persisted rows stay cacheable)', async () => {
    const list = new MessageList();
    list.add('hello', 'input');
    list.addSignal(createSignal({ type: 'reactive', contents: 'Persisted reminder.' }));

    const parts = lastPromptParts(await list.get.all.aiV5.prompt());
    const textPart = parts.find(p => p.type === 'text');

    expect(textPart).toBeDefined();
    expect(textPart?.providerOptions?.mastra?.transient).toBeUndefined();
  });
});
