import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import type { MastraDBMessage } from '../index';

/**
 * Regression tests for #25516.
 *
 * Anthropic models with `thinking.display: "omitted"` (the default on recent
 * models) return reasoning parts with EMPTY text; the thinking block's
 * signature lives in `providerMetadata.anthropic.signature`. The cache key
 * for such a part previously collapsed to `"reasoning" + "" + 0`, so when a
 * later step's reasoning was merged into the response message that already
 * held an earlier step's reasoning, the new block looked like a duplicate
 * and was dropped. The model then lost its own thinking between tool steps.
 */
describe('Anthropic reasoning — empty-text thinking blocks across steps', () => {
  const reasoningPart = (signature: string) =>
    ({
      type: 'reasoning',
      reasoning: '',
      details: [{ type: 'text', text: '', signature: undefined }],
      providerMetadata: { anthropic: { signature } },
    }) as any;

  const responseMessage = (parts: any[]): MastraDBMessage => ({
    id: 'resp-1',
    role: 'assistant',
    content: { format: 2, parts },
    createdAt: new Date('2024-01-01T00:00:01Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
  });

  it('keeps each step`s empty-text reasoning block distinct by its signature', () => {
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add({ role: 'user', content: 'Look up A then B' }, 'input');

    // Step 1: reasoning (sig A) + tool call
    list.add(
      responseMessage([
        reasoningPart('sig-step-1'),
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'lookup',
            args: { letter: 'A' },
            result: { codeWord: 'A-7' },
          },
        },
      ]),
      'response',
    );

    // Step 2: merged into the same response message with only the new step's parts
    list.add(
      responseMessage([
        reasoningPart('sig-step-2'),
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-2',
            toolName: 'lookup',
            args: { letter: 'B' },
            result: { codeWord: 'B-7' },
          },
        },
      ]),
      'response',
    );

    const assistant = list.get.all.db().find(m => m.role === 'assistant')!;
    const signatures = assistant.content.parts
      .filter((p: any) => p.type === 'reasoning')
      .map((p: any) => p.providerMetadata?.anthropic?.signature);

    expect(signatures).toEqual(['sig-step-1', 'sig-step-2']);
  });

  it('keeps redacted thinking blocks distinct by their redactedData', () => {
    const redactedPart = (redactedData: string) =>
      ({
        type: 'reasoning',
        reasoning: '',
        details: [],
        providerMetadata: { anthropic: { redactedData } },
      }) as any;

    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add({ role: 'user', content: 'hi' }, 'input');

    list.add(responseMessage([redactedPart('redacted-1')]), 'response');
    list.add(responseMessage([redactedPart('redacted-2')]), 'response');

    const assistant = list.get.all.db().find(m => m.role === 'assistant')!;
    const data = assistant.content.parts
      .filter((p: any) => p.type === 'reasoning')
      .map((p: any) => p.providerMetadata?.anthropic?.redactedData);

    expect(data).toEqual(['redacted-1', 'redacted-2']);
  });

  it('still dedupes a byte-identical re-add of the same thinking block', () => {
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add({ role: 'user', content: 'hi' }, 'input');

    list.add(responseMessage([reasoningPart('sig-same')]), 'response');
    list.add(responseMessage([reasoningPart('sig-same')]), 'response');

    const assistant = list.get.all.db().find(m => m.role === 'assistant')!;
    const reasoningParts = assistant.content.parts.filter((p: any) => p.type === 'reasoning');
    expect(reasoningParts).toHaveLength(1);
  });
});
