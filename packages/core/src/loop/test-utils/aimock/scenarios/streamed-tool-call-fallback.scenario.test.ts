/**
 * AIMock Scenario: streamed tool call fallback
 *
 * A tool input stream that ends before its final `tool-call` waits for that call. These cover
 * the edges of that wait: provider-supplied IDs that collide with Object.prototype keys, a
 * provider-executed result that arrives without a final call, input streams that fail and are
 * retried with the same ID, and an ID reused by a later step.
 *
 * The `__proto__` and streamed cross-step cases run through HTTP aimock fixtures. The fallback,
 * retry and final-only cross-step cases use the in-process recording model: an HTTP fixture cannot
 * inject an error part mid-stream, end a tool input stream without the provider's final
 * `tool-call`, or send a `tool-call` with no input stream before it.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { StreamErrorRetryProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { createRecordingModel } from '../parity';
import type { ModelTape } from '../parity';

const head = [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'r', modelId: 'm', timestamp: new Date(0) },
];
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const textTape: ModelTape = [
  ...head,
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: 'done' },
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: 'stop', usage },
];

describeForAllEngines('AIMock loop scenario: streamed tool call fallback', engine => {
  const getMock = useLoopScenarioAimock();
  const executed: unknown[] = [];
  const lookup = createTool({
    id: 'lookup',
    description: 'Looks something up',
    inputSchema: z.object({ q: z.string().optional() }),
    execute: async input => {
      executed.push(input);
      return { ok: true };
    },
  });

  const run = async (tapes: ModelTape[], extra: Record<string, unknown> = {}) => {
    executed.length = 0;
    const recording = createRecordingModel({ tapes });
    const { chunks, output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'go',
      tools: { lookup },
      model: () => recording.model,
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: () => {},
      ...extra,
    } as any);
    return { chunks: (chunks ?? []) as any[], output };
  };

  it('handles a streamed tool call whose id is "__proto__"', async () => {
    executed.length = 0;
    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'go',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: '__proto__', name: 'lookup', arguments: { q: 'x' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'done' });
      },
    } as any);

    expect((chunks as any[]).filter(c => c.type === 'error')).toEqual([]);
    expect(
      (chunks as any[]).filter(c => c.type === 'tool-call').map(c => [c.payload.toolCallId, c.payload.args]),
    ).toEqual([['__proto__', { q: 'x' }]]);
    expect(executed).toEqual([{ q: 'x' }]);
  });

  it('emits the fallback call before a result that arrives without a final tool-call', async () => {
    const { chunks, output } = await run([
      [
        ...head,
        { type: 'tool-input-start', id: 'call-x', toolName: 'lookup', providerExecuted: true },
        { type: 'tool-input-delta', id: 'call-x', delta: '{"q":"x"}' },
        { type: 'tool-input-end', id: 'call-x' },
        { type: 'tool-result', toolCallId: 'call-x', toolName: 'lookup', result: { hit: 1 }, providerExecuted: true },
        ...textTape.slice(head.length),
      ],
    ]);

    const types = chunks.filter(c => c.payload?.toolCallId === 'call-x').map(c => c.type);
    expect(types.filter(t => t === 'tool-call' || t === 'tool-result')).toEqual(['tool-call', 'tool-result']);
    expect(chunks.find(c => c.type === 'tool-call')?.payload.args).toEqual({ q: 'x' });
    // Ported from the AI SDK tools suite (PTC regression): the stream must not stall waiting
    // for a final call, the provider result passes through, and the local tool never runs.
    expect(chunks.find(c => c.type === 'tool-result')?.payload).toMatchObject({
      result: { hit: 1 },
      providerExecuted: true,
    });
    expect(executed).toEqual([]);
    expect(await output.text).toBe('done');
    expect(chunks.some(c => c.type === 'finish')).toBe(true);
  });

  it('runs only the retried call when a no-args input stream fails and is retried with the same id', async () => {
    const { chunks } = await run(
      [
        [
          ...head,
          { type: 'tool-input-start', id: 'call-r', toolName: 'lookup' },
          { type: 'tool-input-end', id: 'call-r' },
          { type: 'error', error: { message: 'boom', isRetryable: true } },
        ],
        [
          ...head,
          { type: 'tool-input-start', id: 'call-r', toolName: 'lookup' },
          { type: 'tool-input-end', id: 'call-r' },
          { type: 'tool-call', toolCallId: 'call-r', toolName: 'lookup', input: '{"q":"real"}' },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ],
        textTape,
      ],
      { errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, retryUnknownErrors: true })] },
    );

    expect(chunks.filter(c => c.type === 'tool-call').map(c => c.payload.args)).toEqual([{ q: 'real' }]);
    expect(executed).toEqual([{ q: 'real' }]);
  });

  it('emits the real call after a partial-args call from a failed attempt with the same id', async () => {
    const { chunks } = await run(
      [
        [
          ...head,
          { type: 'tool-input-start', id: 'call-p', toolName: 'lookup' },
          { type: 'tool-input-delta', id: 'call-p', delta: '{"q":"old"}' },
          { type: 'tool-input-end', id: 'call-p' },
          { type: 'error', error: { message: 'boom', isRetryable: true } },
        ],
        [
          ...head,
          { type: 'tool-input-start', id: 'call-p', toolName: 'lookup' },
          { type: 'tool-input-delta', id: 'call-p', delta: '{"q":"real"}' },
          { type: 'tool-input-end', id: 'call-p' },
          { type: 'tool-call', toolCallId: 'call-p', toolName: 'lookup', input: '{"q":"real"}' },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ],
        textTape,
      ],
      { errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, retryUnknownErrors: true })] },
    );

    const calls = chunks.filter(c => c.type === 'tool-call' || c.type === 'tool-result');
    expect(calls.map(c => [c.type, c.payload.args])).toEqual([
      ['tool-call', { q: 'old' }],
      ['tool-call', { q: 'real' }],
      ['tool-result', { q: 'real' }],
    ]);
  });

  it('keeps both calls when a later step reuses a streamed tool call id', async () => {
    executed.length = 0;
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'go',
      tools: { lookup },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: { q: 'one' } }] },
        );
        llm.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: { q: 'two' } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'done' });
      },
    } as any);

    const toolCalls = (await output.toolCalls) as any[];
    expect(toolCalls.map(c => c.payload.args)).toEqual([{ q: 'one' }, { q: 'two' }]);
    expect(executed).toEqual([{ q: 'one' }, { q: 'two' }]);
  });

  it('keeps both calls when a later step reuses a final-only tool call id', async () => {
    const step = (args: string): ModelTape => [
      ...head,
      { type: 'tool-call', toolCallId: 'call_0', toolName: 'lookup', input: args },
      { type: 'finish', finishReason: 'tool-calls', usage },
    ];
    const { chunks, output } = await run([step('{"q":"one"}'), step('{"q":"two"}'), textTape]);

    expect(chunks.filter(c => c.type === 'tool-call').map(c => c.payload.args)).toEqual([{ q: 'one' }, { q: 'two' }]);
    expect(((await output.toolCalls) as any[]).map(c => c.payload.args)).toEqual([{ q: 'one' }, { q: 'two' }]);
    expect(executed).toEqual([{ q: 'one' }, { q: 'two' }]);
  });
});
