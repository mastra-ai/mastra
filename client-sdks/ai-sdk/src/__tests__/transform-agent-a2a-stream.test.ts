import { describe, expect, it } from 'vitest';

import { transformAgent } from '../transformers';

/**
 * Regression coverage for start-less sub-agent streams and the legacy
 * A2AAgent chunk contract through handleChatStream.
 *
 * Resumed Agent and A2AAgent streams omit `start`, so the buffered run state
 * may not exist when the first content chunk arrives. A2AAgent versions from
 * before the chunk contracts were aligned also omitted `start` on fresh runs
 * and emitted a flat `{ finishReason, usage }` payload.
 *
 * Both cases previously crashed transformAgent ("Cannot read properties of
 * undefined (reading 'text')" and "... (reading 'reason')"), killing the UI
 * stream with an error chunk.
 */
describe('transformAgent start-less and legacy A2A sub-agent streams', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  const EMPTY_USAGE = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };

  it('handles a legacy A2A-shaped stream without a start chunk', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'a2a-run';

    // Older A2AAgent streams began with text-start/text-delta.
    const firstDelta = transformAgent(
      makePayload('text-delta', runId, { id: 'text-1', text: 'Shipment ord_1003 ' }),
      bufferedSteps,
    );

    expect(firstDelta).toMatchObject({
      type: 'data-tool-agent',
      id: runId,
      data: { text: 'Shipment ord_1003 ', status: 'running' },
    });

    transformAgent(makePayload('text-delta', runId, { id: 'text-1', text: 'is in transit.' }), bufferedSteps);

    // Legacy flat A2A finish payload: no stepResult / output wrappers.
    const finish = transformAgent(
      makePayload('finish', runId, { finishReason: 'stop', usage: EMPTY_USAGE }),
      bufferedSteps,
    );

    expect(finish).toMatchObject({
      type: 'data-tool-agent',
      id: runId,
      data: {
        text: 'Shipment ord_1003 is in transit.',
        finishReason: 'stop',
        usage: EMPTY_USAGE,
        status: 'finished',
      },
    });
  });

  it('handles reasoning-delta, source, and file chunks without a start chunk', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'a2a-run';

    const reasoning = transformAgent(makePayload('reasoning-delta', runId, { text: 'thinking' }), bufferedSteps);
    expect(reasoning?.data.reasoning).toEqual(['thinking']);

    const source = transformAgent(
      makePayload('source', 'a2a-run-source', { id: 'src-1', url: 'https://example.com' }),
      bufferedSteps,
    );
    expect(source?.data.sources).toEqual([{ id: 'src-1', url: 'https://example.com' }]);

    const file = transformAgent(
      makePayload('file', 'a2a-run-file', { name: 'report.txt', content: 'hello' }),
      bufferedSteps,
    );
    expect(file?.data.files).toEqual([{ name: 'report.txt', content: 'hello' }]);
  });

  it('handles a finish chunk arriving without any prior chunks', () => {
    const bufferedSteps = new Map<string, any>();

    const finish = transformAgent(
      makePayload('finish', 'a2a-finish-only', { finishReason: 'stop', usage: EMPTY_USAGE }),
      bufferedSteps,
    );

    expect(finish).toMatchObject({
      type: 'data-tool-agent',
      data: { finishReason: 'stop', status: 'finished' },
    });
  });

  it('handles tool-call and object chunks without a start chunk (resumed streams)', () => {
    // Resumed Agent streams also skip the `start` chunk (core's
    // loop/workflows/stream.ts only emits it when there is no resumeContext).
    const bufferedSteps = new Map<string, any>();
    const runId = 'resumed-run';

    const toolCall = transformAgent(
      makePayload('tool-call', runId, { toolCallId: 'call-1', toolName: 'weather', args: { city: 'Paris' } }),
      bufferedSteps,
    );
    expect(toolCall?.data.toolCalls).toEqual([{ toolCallId: 'call-1', toolName: 'weather', args: { city: 'Paris' } }]);

    const objectChunk = transformAgent(
      { type: 'object', runId: 'resumed-run-object', object: { answer: 42 } } as any,
      bufferedSteps,
    );
    expect(objectChunk?.data.object).toEqual({ answer: 42 });
    expect(objectChunk?.data.toolCalls).toEqual([]);
  });

  it('still prefers the regular Agent finish payload shape', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'agent-run';

    transformAgent(makePayload('start', runId, { id: 'agent-1' }), bufferedSteps);
    transformAgent(makePayload('text-delta', runId, { id: 'text-1', text: 'Done.' }), bufferedSteps);

    const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    const finish = transformAgent(
      makePayload('finish', runId, {
        stepResult: { reason: 'tool-calls', warnings: ['w'] },
        output: { usage },
        response: { modelId: 'test-model' },
      }),
      bufferedSteps,
    );

    expect(finish).toMatchObject({
      type: 'data-tool-agent',
      data: {
        text: 'Done.',
        finishReason: 'tool-calls',
        usage,
        warnings: ['w'],
        status: 'finished',
        response: { modelId: 'test-model' },
      },
    });
  });
});
