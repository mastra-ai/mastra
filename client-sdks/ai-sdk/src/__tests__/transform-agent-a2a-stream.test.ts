import { describe, expect, it } from 'vitest';

import { transformAgent } from '../transformers';

/**
 * Regression test for A2AAgent sub-agent delegation through handleChatStream.
 *
 * A2AAgent remote streams differ from regular Agent streams in two ways:
 *
 * 1. They never emit a `start` chunk — the first chunks are
 *    `text-start` / `text-delta` — so the buffered run state for the runId
 *    does not exist when the first content chunk arrives.
 * 2. Their `finish` chunk carries a flat `{ finishReason, usage }` payload
 *    instead of the regular Agent shape `{ stepResult: { reason }, output: { usage } }`.
 *
 * Both previously crashed transformAgent ("Cannot read properties of
 * undefined (reading 'text')" and "... (reading 'reason')"), killing the UI
 * stream with an error chunk.
 */
describe('transformAgent A2A sub-agent streams', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  const EMPTY_USAGE = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };

  it('handles a full A2A-shaped stream without a start chunk', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'a2a-run';

    // No `start` chunk — A2A streams begin with text-start/text-delta.
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

    // Flat A2A finish payload: no stepResult / output wrappers.
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
