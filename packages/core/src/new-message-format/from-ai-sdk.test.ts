import type { TextStreamPart, ToolSet } from '@internal/ai-v7';
import { describe, expect, it } from 'vitest';
import { actionsFromAISDKStream, streamActions } from './from-ai-sdk';
import { InMemoryActionStorage } from './storage';
import { createUlid } from './ulid';

const usage = {
  inputTokens: 10,
  inputTokenDetails: { noCacheTokens: 6, cacheReadTokens: 4, cacheWriteTokens: undefined },
  outputTokens: 7,
  outputTokenDetails: { textTokens: 5, reasoningTokens: 2 },
  totalTokens: 17,
};

const toolCall = { type: 'tool-call', toolCallId: 'call-1', toolName: 'deleteFile', input: { path: 'a.txt' } } as const;

/** v7 stream parts OpenAI doesn't produce on demand: approvals, denial, reasoning files, custom, raw, abort. */
const parts = [
  { type: 'start' },
  { type: 'start-step', request: {}, warnings: [] },
  { type: 'reasoning-start', id: 'r1' },
  { type: 'reasoning-delta', id: 'r1', text: 'think' },
  { type: 'reasoning-end', id: 'r1', providerMetadata: { openai: { itemId: 'rs_1' } } },
  { type: 'reasoning-file', file: { mediaType: 'image/png', base64: 'AAAA' } },
  { type: 'custom', kind: 'openai.compaction', providerMetadata: { openai: { summary: 's' } } },
  { type: 'raw', rawValue: { anything: true } },
  { type: 'tool-input-start', id: 'call-1', toolName: 'deleteFile' },
  { type: 'tool-input-delta', id: 'call-1', delta: '{}' },
  { type: 'tool-input-end', id: 'call-1' },
  toolCall,
  { type: 'tool-approval-request', approvalId: 'ap-1', toolCall, reason: 'destructive' },
  { type: 'tool-approval-response', approvalId: 'ap-1', toolCall, approved: false, reason: 'no' },
  { type: 'tool-output-denied', toolCallId: 'call-1', toolName: 'deleteFile' },
  {
    type: 'finish-step',
    response: { id: 'resp-1', modelId: 'gpt-5-mini-2025-08-07', timestamp: new Date() },
    usage,
    performance: {},
    finishReason: 'tool-calls',
    rawFinishReason: undefined,
    providerMetadata: undefined,
  },
  { type: 'abort', reason: 'user cancelled' },
  { type: 'finish', finishReason: 'other', rawFinishReason: undefined, totalUsage: usage },
] as unknown as TextStreamPart<ToolSet>[];

async function* stream() {
  yield* parts;
}

describe('actionsFromAISDKStream (v7)', () => {
  it('maps every v7 stream part type and drops framing parts', async () => {
    const actions = await actionsFromAISDKStream(stream(), {
      threadId: 't',
      runId: 'r',
      modelId: 'gpt-5-mini',
      generateId: createUlid(),
    });

    expect(actions.map(a => a.type)).toEqual([
      'turn-start',
      'reasoning-start',
      'reasoning-delta',
      'reasoning',
      'reasoning-file',
      'provider-event',
      'raw-chunk',
      'tool-input-start',
      'tool-input-delta',
      'tool-call',
      'tool-approval-requested',
      'tool-approval-responded',
      'tool-denied',
      'turn-end',
      'run-aborted',
      'run-end',
    ]);

    const byType = Object.fromEntries(actions.map(a => [a.type, a]));
    expect(byType['reasoning']).toMatchObject({ text: 'think', providerMetadata: { openai: { itemId: 'rs_1' } } });
    expect(byType['reasoning-file']).toMatchObject({ mediaType: 'image/png', data: 'AAAA' });
    expect(byType['provider-event']).toMatchObject({
      kind: 'openai.compaction',
      providerMetadata: { openai: { summary: 's' } },
    });
    expect(byType['tool-approval-requested']).toMatchObject({ toolCallId: 'call-1', approvalId: 'ap-1' });
    expect(byType['tool-approval-responded']).toMatchObject({ approvalId: 'ap-1', approved: false, reason: 'no' });
    expect(byType['tool-denied']).toMatchObject({ toolCallId: 'call-1', toolName: 'deleteFile' });
    expect(byType['turn-end']).toMatchObject({
      finishReason: 'tool-calls',
      modelId: 'gpt-5-mini-2025-08-07',
      responseId: 'resp-1',
      usage: { inputTokens: 10, outputTokens: 7, reasoningTokens: 2, cacheReadTokens: 4 },
    });
    expect(byType['turn-end']!).not.toHaveProperty('usage.cacheWriteTokens');
    expect(byType['run-aborted']).toMatchObject({ reason: 'user cancelled' });
  });

  it('transient actions (deltas, raw chunks) are streamed but never persisted', async () => {
    const storage = new InMemoryActionStorage();
    const actions = await actionsFromAISDKStream(stream(), { threadId: 't', modelId: 'm', generateId: createUlid() });
    await storage.record(actions);

    const stored = await storage.listActions({ threadId: 't' });
    expect(stored.map(a => a.type)).toEqual(actions.filter(a => !a.transient).map(a => a.type));
    const transientTypes = ['raw-chunk', 'reasoning-start', 'reasoning-delta', 'tool-input-start', 'tool-input-delta'];
    expect(stored.some(a => transientTypes.includes(a.type))).toBe(false);
  });

  it('streams deltas before the finished action, linked by contentId', async () => {
    async function* textStream() {
      yield* [
        { type: 'start-step', request: {}, warnings: [] },
        { type: 'text-start', id: 'x' },
        { type: 'text-delta', id: 'x', text: 'Hel' },
        { type: 'reasoning-start', id: 'y' },
        { type: 'text-delta', id: 'x', text: 'lo' },
        { type: 'reasoning-delta', id: 'y', text: 'hm' },
        { type: 'text-end', id: 'x' },
        { type: 'reasoning-end', id: 'y' },
        { type: 'tool-result', toolCallId: 'c', toolName: 'w', input: {}, output: { n: 1 }, preliminary: true },
        { type: 'tool-result', toolCallId: 'c', toolName: 'w', input: {}, output: { n: 2 } },
      ] as unknown as TextStreamPart<ToolSet>[];
    }
    const seen: string[] = [];
    for await (const a of streamActions(textStream(), { threadId: 't', modelId: 'm', generateId: createUlid() })) {
      seen.push(a.type);
      if (a.type === 'text') expect(a.text).toBe('Hello');
      if (a.type === 'reasoning') expect(a.text).toBe('hm');
    }
    expect(seen).toEqual([
      'turn-start',
      'text-start',
      'text-delta',
      'reasoning-start',
      'text-delta',
      'reasoning-delta',
      'text',
      'reasoning',
      'tool-output-delta',
      'tool-result',
    ]);

    const actions = await actionsFromAISDKStream(textStream(), {
      threadId: 't',
      modelId: 'm',
      generateId: createUlid(),
    });
    const text = actions.find(a => a.type === 'text')!;
    const textDeltas = actions.filter(a => a.type === 'text-start' || a.type === 'text-delta');
    expect(textDeltas.every(a => 'contentId' in a && a.contentId === (text as { contentId?: string }).contentId)).toBe(
      true,
    );
    const ids = actions.map(a => a.id);
    expect([...ids].sort()).toEqual(ids);
  });
});
