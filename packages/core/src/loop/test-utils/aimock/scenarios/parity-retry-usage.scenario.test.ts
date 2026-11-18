/**
 * COR-1554: a model stream that fails mid-reply with a retryable error, then
 * succeeds on the retry.
 *
 * The retried request is a re-attempt of the same step on every engine: the
 * run has one step, the failed attempt's partial text is dropped, and the run
 * reports the successful attempt's usage. Plain used to close the failed
 * attempt as its own `reason: 'retry'` step, which counted an extra step and,
 * because that attempt reported no token counts, wiped the run's usage totals.
 */

import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { StreamErrorRetryProcessor } from '../../../../processors';
import {
  type EngineParityResults,
  type EngineParityScenario,
  type ModelScript,
  type ParityTarget,
  describeParity,
  expectParity,
  textOnlyTape,
} from '../parity';

const REPORTED_USAGE = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

/** Streams one text delta, then fails with an error the retry processor accepts. */
const CUT_THEN_RETRYABLE = [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: 'partial ' },
  { type: 'error', error: Object.assign(new Error('COR-1554 stream cut'), { isRetryable: true }) },
] as const;

const MODEL: ModelScript = { tapes: [CUT_THEN_RETRYABLE as any, textOnlyTape('done', REPORTED_USAGE)] };

function scenario(): Omit<EngineParityScenario, 'engines'> {
  return {
    model: MODEL,
    buildAgent: ({ model }) =>
      new Agent({
        id: 'retry-usage-agent',
        name: 'Retry Usage Agent',
        instructions: 'Follow the script.',
        model,
        memory: new MockMemory(),
        errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 2, delayMs: 0 })],
      }),
    input: 'Go.',
    options: { memory: { thread: 'thread-retry-usage', resource: 'resource-retry-usage' } },
  };
}

function turnsByEngine(target: ParityTarget, results: EngineParityResults) {
  return (['plain', target] as const).map(engine => ({ engine, turn: results[engine]!.turns[0]! }));
}

describeParity('retried stream error parity', target => {
  it('a retried mid-stream error is one step and keeps the retry attempt usage on every engine', async () => {
    const results = await expectParity(target, scenario());

    for (const { engine, turn } of turnsByEngine(target, results)) {
      expect(results[engine]?.requests.length, `${engine} model calls`).toBe(2);
      expect(turn.text, `${engine} text`).toBe('done');
      expect(turn.finishReason, `${engine} finishReason`).toBe('stop');
      expect(turn.stepCount, `${engine} stepCount`).toBe(1);
      expect(
        turn.chunkTypes.filter(type => type === 'step-finish'),
        `${engine} step-finish`,
      ).toHaveLength(1);
      const usage = { ...REPORTED_USAGE, raw: REPORTED_USAGE };
      expect(turn.usage, `${engine} usage`).toEqual(usage);
      expect(turn.fullOutput?.usage, `${engine} fullOutput.usage`).toEqual(usage);
      expect(turn.finishChunk?.usage, `${engine} finish chunk usage`).toEqual(usage);
    }
  });
});
