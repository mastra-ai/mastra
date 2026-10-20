/**
 * AIMock Scenario: streamed tool call fallback
 *
 * A tool input stream that ends before its final `tool-call` waits for that call. These cover
 * the edges of that wait: provider-supplied IDs that collide with Object.prototype keys, a
 * provider-executed result that arrives without a final call, and a no-args input stream
 * that fails and is retried.
 *
 * Uses the in-process recording model rather than HTTP aimock fixtures: real AI SDK providers
 * emit `tool-call` straight after `tool-input-end` and cannot express a mid-stream error part,
 * so none of these stream shapes are reachable through an HTTP fixture.
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
    const { chunks } = await runLoopScenario({
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
    return (chunks ?? []) as any[];
  };

  it('handles a streamed tool call whose id is "__proto__"', async () => {
    const chunks = await run([
      [
        ...head,
        { type: 'tool-input-start', id: '__proto__', toolName: 'lookup' },
        { type: 'tool-input-delta', id: '__proto__', delta: '{"q":"x"}' },
        { type: 'tool-input-end', id: '__proto__' },
        { type: 'tool-call', toolCallId: '__proto__', toolName: 'lookup', input: '{"q":"x"}' },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ],
      textTape,
    ]);

    expect(chunks.filter(c => c.type === 'error')).toEqual([]);
    expect(chunks.filter(c => c.type === 'tool-call').map(c => [c.payload.toolCallId, c.payload.args])).toEqual([
      ['__proto__', { q: 'x' }],
    ]);
    expect(executed).toEqual([{ q: 'x' }]);
  });

  it('emits the fallback call before a result that arrives without a final tool-call', async () => {
    const chunks = await run([
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
  });

  it('runs only the retried call when a no-args input stream fails and is retried with the same id', async () => {
    const chunks = await run(
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
    const chunks = await run(
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
});
