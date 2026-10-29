/**
 * Issue #28641: a durable run recovered after a crash must still run its
 * `isTaskComplete` check. The scorer instances never reach storage, so recovery
 * restores them from the agent's `defaultOptions.isTaskComplete`; a per-call
 * policy cannot be restored and the recovered run must say so in a warning
 * rather than skip the check silently.
 *
 * The model is a MockLanguageModelV2 rather than aimock: the restart harness
 * loads a fresh module graph per process and parks graph 1 inside a tool call
 * on an in-process gate, the same shape as the sibling recovery suites.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createScorer } from '../../../evals';
import { createGate, createRestartScenario } from './restart-harness';
import type { CoreGraph, Gate } from './restart-harness';

// Calls `work` once, then answers DRAFT; once the transcript already holds the
// DRAFT answer (a rejected completion check), answers CONFIRMED. A pure
// function of the prompt, so both process generations script the same run.
function createModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const worked = prompt.some(m => m.role === 'tool');
      const drafted = prompt.some(m => m.role === 'assistant' && JSON.stringify(m.content).includes('DRAFT'));
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const parts = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `r-${worked}`, modelId: 'script', timestamp: new Date(0) },
        ...(worked
          ? [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: drafted ? 'CONFIRMED' : 'DRAFT' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ]
          : [
              { type: 'tool-call', toolCallId: 'work-1', toolName: 'work', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]),
      ];
      return { stream: convertArrayToReadableStream(parts as any[]), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

function createCompleteScorer(calls: { count: number }) {
  return createScorer({ id: 'recovery-complete', description: 'always complete' }).generateScore(async () => {
    calls.count++;
    return 1;
  });
}

// Rejects the answer until it says CONFIRMED, like the issue's reproduction.
function createConfirmedScorer(calls: { count: number }) {
  return createScorer({ id: 'recovery-confirmed', description: 'needs CONFIRMED' }).generateScore(async ({ run }) => {
    calls.count++;
    return String((run.input as { currentText?: string })?.currentText ?? '').includes('CONFIRMED') ? 1 : 0;
  });
}

function buildAgent(core: CoreGraph, { gate, defaultScorer }: { gate?: Gate; defaultScorer?: any }) {
  return new core.Agent({
    id: 'itc-recovery-agent',
    name: 'itc-recovery-agent',
    instructions: 'Do the work, then answer.',
    model: createModel(),
    defaultOptions: defaultScorer ? { isTaskComplete: { scorers: [defaultScorer] } } : undefined,
    tools: {
      work: core.createTool({
        id: 'work',
        description: 'Do the work.',
        inputSchema: z.object({}),
        execute: async () => {
          await gate?.wait();
          return { ok: true };
        },
      }),
    },
  });
}

// Every logger graph 2's Mastra hands out reports its warnings here.
function captureWarnings(core: CoreGraph, warnings: string[]) {
  const original = core.Mastra.prototype.getLogger;
  vi.spyOn(core.Mastra.prototype, 'getLogger').mockImplementation(function (this: any) {
    const logger = original.call(this);
    if (!vi.isMockFunction(logger.warn)) {
      const warn = logger.warn.bind(logger);
      vi.spyOn(logger, 'warn').mockImplementation((message: unknown, ...rest: unknown[]) => {
        warnings.push(String(message));
        return warn(message as string, ...rest);
      });
    }
    return logger;
  });
}

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
  vi.restoreAllMocks();
});

async function crashInsideTool(
  scenario: ReturnType<typeof createRestartScenario>,
  gate: Gate,
  streamOptions: (core: CoreGraph) => Record<string, unknown>,
) {
  const original = await scenario.start(({ agent, core }) => agent.stream('Go.', streamOptions(core)));
  const drained = original.driven
    .then(async (result: any) => {
      for await (const _ of result.fullStream);
    })
    .then(
      () => 'ended' as const,
      () => 'ended' as const,
    );
  const reached = await Promise.race([gate.reached.then(() => 'reached' as const), drained]);
  expect(reached, 'not exercised: the run ended before the tool call').toBe('reached');
  return original.checkpoint();
}

describe('isTaskComplete across recovery (#28641)', () => {
  for (const kind of ['durable', 'evented'] as const) {
    it(`${kind}: a recovered run runs the agent's default isTaskComplete scorers`, async () => {
      const runId = `itc-recover-default-${kind}`;
      const gate = createGate();
      gates.push(gate);
      const calls = new Map<number, { count: number }>();
      const scenario = createRestartScenario({
        kind,
        runId,
        build: ({ core, generation }) => {
          const scorerCalls = { count: 0 };
          calls.set(generation, scorerCalls);
          return buildAgent(core, {
            gate: generation === 1 ? gate : undefined,
            defaultScorer: createCompleteScorer(scorerCalls),
          });
        },
      });
      scenarios.push(scenario);
      const checkpoint = await crashInsideTool(scenario, gate, () => ({ runId }));

      const recovered = await scenario.restart(checkpoint);
      expect(recovered.streamErrors).toEqual([]);
      expect(recovered.executionError).toBeUndefined();
      expect(recovered.text).toBe('DRAFT');
      expect(recovered.chunkTypes, 'recovered stream emits is-task-complete').toContain('is-task-complete');
      expect(calls.get(2)!.count, 'graph 2 ran the default scorer').toBeGreaterThanOrEqual(1);
    }, 30_000);
  }

  for (const kind of ['durable', 'evented'] as const) {
    it(`${kind}: a recovered run retries until the agent's default scorer accepts`, async () => {
      const runId = `itc-recover-confirmed-${kind}`;
      const gate = createGate();
      gates.push(gate);
      const calls = new Map<number, { count: number }>();
      const scenario = createRestartScenario({
        kind,
        runId,
        build: ({ core, generation }) => {
          const scorerCalls = { count: 0 };
          calls.set(generation, scorerCalls);
          return buildAgent(core, {
            gate: generation === 1 ? gate : undefined,
            defaultScorer: createConfirmedScorer(scorerCalls),
          });
        },
      });
      scenarios.push(scenario);
      const checkpoint = await crashInsideTool(scenario, gate, () => ({ runId }));

      const recovered = await scenario.restart(checkpoint);
      expect(recovered.streamErrors).toEqual([]);
      expect(recovered.executionError).toBeUndefined();
      // The retry rotates the message id, so the stream's final text is the accepted answer.
      expect(recovered.text).toBe('CONFIRMED');
      expect(calls.get(2)!.count, 'graph 2 rejected, then accepted').toBeGreaterThanOrEqual(2);
    }, 30_000);
  }

  it('durable: a per-call isTaskComplete policy that cannot be restored is reported in a warning', async () => {
    const runId = 'itc-recover-per-call';
    const gate = createGate();
    gates.push(gate);
    const warnings: string[] = [];
    const scenario = createRestartScenario({
      kind: 'durable',
      runId,
      build: ({ core, generation }) => {
        if (generation === 2) captureWarnings(core, warnings);
        return buildAgent(core, { gate: generation === 1 ? gate : undefined });
      },
    });
    scenarios.push(scenario);
    const checkpoint = await crashInsideTool(scenario, gate, () => ({
      runId,
      isTaskComplete: { scorers: [createCompleteScorer({ count: 0 })] },
    }));

    const recovered = await scenario.restart(checkpoint);
    expect(recovered.streamErrors).toEqual([]);
    expect(recovered.text).toBe('DRAFT');
    expect(recovered.chunkTypes).not.toContain('is-task-complete');
    expect(
      warnings.some(w => w.includes(runId) && w.includes('isTaskComplete') && w.includes('cannot be restored')),
      `warning about the unrestorable check: ${warnings.join(' | ')}`,
    ).toBe(true);
  }, 30_000);

  // The persisted shadow only carries scorer names, so a per-call scorer that
  // shares a name with the agent default would look restorable. Recovery must
  // not swap the default in for it.
  it('durable: a per-call scorer named like the default is not replaced by the default', async () => {
    const runId = 'itc-recover-per-call-same-name';
    const gate = createGate();
    gates.push(gate);
    const warnings: string[] = [];
    const calls = new Map<number, { count: number }>();
    const scenario = createRestartScenario({
      kind: 'durable',
      runId,
      build: ({ core, generation }) => {
        if (generation === 2) captureWarnings(core, warnings);
        const scorerCalls = { count: 0 };
        calls.set(generation, scorerCalls);
        return buildAgent(core, {
          gate: generation === 1 ? gate : undefined,
          defaultScorer: createCompleteScorer(scorerCalls),
        });
      },
    });
    scenarios.push(scenario);
    const checkpoint = await crashInsideTool(scenario, gate, () => ({
      runId,
      isTaskComplete: { scorers: [createCompleteScorer({ count: 0 })] },
    }));

    const recovered = await scenario.restart(checkpoint);
    expect(recovered.streamErrors).toEqual([]);
    expect(recovered.text).toBe('DRAFT');
    expect(recovered.chunkTypes).not.toContain('is-task-complete');
    expect(calls.get(2)!.count, 'the default scorer did not stand in for the per-call one').toBe(0);
    expect(warnings.some(w => w.includes(runId) && w.includes('cannot be restored'))).toBe(true);
  }, 30_000);
});
