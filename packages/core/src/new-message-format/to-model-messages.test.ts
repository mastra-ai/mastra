import { createAnthropic } from '@ai-sdk/anthropic-v7';
import { streamText } from '@internal/ai-v7';
import { describe, expect, it } from 'vitest';
import type { ActionDraft } from './to-actions';
import { toActions } from './to-actions';
import { toModelMessages } from './to-model-messages';
import type { PersistableAction } from './types';

let n = 0;
const stamp = (drafts: ActionDraft[]) =>
  drafts.map(
    d => ({ ...d, id: String(n++).padStart(4, '0'), threadId: 't', createdAt: new Date(0) }) as PersistableAction,
  );

describe('toModelMessages', () => {
  it('folds a tool turn into assistant tool-call + tool result, and drops lifecycle actions', () => {
    const log = stamp([
      { type: 'text', role: 'user', text: 'weather?' },
      { type: 'turn-start', modelId: 'm' },
      { type: 'reasoning', role: 'assistant', text: 'r', providerMetadata: { openai: { itemId: 'rs_1' } } },
      { type: 'tool-call', role: 'assistant', toolCallId: 'c1', toolName: 'w', input: { c: 'SF' } },
      { type: 'tool-result', toolCallId: 'c1', toolName: 'w', output: { t: 21 } },
      { type: 'turn-end', finishReason: 'tool-calls', usage: {} },
      { type: 'turn-start', modelId: 'm' },
      { type: 'text', role: 'assistant', text: 'sunny' },
      { type: 'turn-end', finishReason: 'stop', usage: {} },
      { type: 'run-end', finishReason: 'stop', usage: {} },
    ]);
    expect(toModelMessages(log)).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'weather?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'r', providerOptions: { openai: { itemId: 'rs_1' } } },
          { type: 'tool-call', toolCallId: 'c1', toolName: 'w', input: { c: 'SF' } },
        ],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'c1', toolName: 'w', output: { type: 'json', value: { t: 21 } } }],
      },
      { role: 'assistant', content: [{ type: 'text', text: 'sunny' }] },
    ]);
  });

  it('maps errors, denials, approvals and signals', () => {
    const log = stamp([
      { type: 'tool-call', role: 'assistant', toolCallId: 'c1', toolName: 'w', input: {} },
      { type: 'tool-call', role: 'assistant', toolCallId: 'c2', toolName: 'w', input: {} },
      { type: 'tool-approval-requested', toolCallId: 'c1', toolName: 'w', approvalId: 'a1' },
      { type: 'tool-approval-responded', toolCallId: 'c1', toolName: 'w', approvalId: 'a1', approved: false },
      { type: 'tool-denied', toolCallId: 'c1', toolName: 'w', reason: 'no' },
      { type: 'tool-error', toolCallId: 'c2', toolName: 'w', errorText: 'boom' },
      { type: 'signal', category: 'notification', tagName: 'note', contents: [{ type: 'text', text: 'hi' }] },
    ]);
    const msgs = toModelMessages(log);
    expect(msgs[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'c1', toolName: 'w', input: {} },
        { type: 'tool-call', toolCallId: 'c2', toolName: 'w', input: {} },
        { type: 'tool-approval-request', approvalId: 'a1', toolCallId: 'c1' },
      ],
    });
    expect(msgs[1]!.content).toEqual([
      { type: 'tool-approval-response', approvalId: 'a1', approved: false },
      { type: 'tool-result', toolCallId: 'c1', toolName: 'w', output: { type: 'execution-denied', reason: 'no' } },
      { type: 'tool-result', toolCallId: 'c2', toolName: 'w', output: { type: 'error-text', value: 'boom' } },
    ]);
    expect(msgs[2]).toEqual({ role: 'user', content: [{ type: 'text', text: '<note>hi</note>' }] });
  });

  it('round-trips v7 ModelMessage input through actions', () => {
    const input = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'q' }] },
      {
        role: 'assistant' as const,
        content: [{ type: 'tool-call' as const, toolCallId: 'c', toolName: 't', input: { a: 1 } }],
      },
      {
        role: 'tool' as const,
        content: [
          { type: 'tool-result' as const, toolCallId: 'c', toolName: 't', output: { type: 'json' as const, value: 1 } },
        ],
      },
    ];
    expect(toModelMessages(stamp(toActions(input).actions))).toEqual(input);
  });

  it('sends the files inside a signal, not just their names', () => {
    const [message] = toModelMessages(
      stamp([
        {
          type: 'signal',
          category: 'notification',
          tagName: 'upload',
          contents: [
            { type: 'text', text: 'see attached' },
            { type: 'file', data: 'aGVsbG8=', mediaType: 'text/plain', filename: 'a.txt' },
          ],
        },
      ]),
    );
    expect(message).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: '<upload>see attached\n[file a.txt]</upload>' },
        { type: 'file', data: 'aGVsbG8=', mediaType: 'text/plain', filename: 'a.txt' },
      ],
    });
  });

  it('sends redacted reasoning back to Anthropic as redacted_thinking', async () => {
    const log = stamp([
      ...toActions({ role: 'user', content: 'hi' }).actions,
      ...toActions({
        role: 'assistant',
        content: [
          { type: 'redacted-reasoning', data: 'ENCRYPTED' },
          { type: 'text', text: 'Hello.' },
        ],
      }).actions,
      ...toActions({ role: 'user', content: 'again' }).actions,
    ]);
    let body: { messages: { content: { type: string; data?: string }[] }[] } | undefined;
    const anthropic = createAnthropic({
      apiKey: 'test',
      fetch: async (_url, init) => {
        body = JSON.parse(String(init!.body));
        return new Response('{}', { status: 500 });
      },
    });
    const result = streamText({ model: anthropic('claude-sonnet-4-5'), messages: toModelMessages(log), maxRetries: 0 });
    for await (const _ of result.fullStream) void _;

    expect(body!.messages[1]!.content).toContainEqual({ type: 'redacted_thinking', data: 'ENCRYPTED' });
  });
});
