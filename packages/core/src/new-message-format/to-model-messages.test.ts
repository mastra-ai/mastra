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
});
