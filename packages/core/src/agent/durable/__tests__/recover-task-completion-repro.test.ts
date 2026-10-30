import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { createGate, createRestartScenario } from './restart-harness';

const scenarios: ReturnType<typeof createRestartScenario<'durable'>>[] = [];
const gates: ReturnType<typeof createGate>[] = [];

afterEach(async () => {
  for (const gate of gates) gate.release();
  for (const scenario of scenarios) await scenario.stop();
  gates.length = 0;
  scenarios.length = 0;
});

describe.each(['durable', 'evented'] as const)('recovered %s completion policy', kind => {
  it('does not accept an unchecked draft after restart', async () => {
    const gate = createGate();
    gates.push(gate);
    const checked: number[] = [];
    let recoveredCalls = 0;
    const scenario = createRestartScenario({
      kind,
      runId: `life-coach-completion-${kind}`,
      build: ({ core, generation }) =>
        new core.Agent({
          id: 'life-coach-completion-repro',
          name: 'Life Coach',
          instructions: 'Confirm the commitment with the user before treating it as final.',
          model: new MockLanguageModelV2({
            doStream: async () => {
              if (generation === 1) await gate.wait();
              else recoveredCalls++;
              const text = generation === 2 && recoveredCalls > 1 ? 'CONFIRMED' : 'DRAFT';
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'response', modelId: 'script', timestamp: new Date(0) },
                  { type: 'text-start', id: 'answer' },
                  { type: 'text-delta', id: 'answer', delta: text },
                  { type: 'text-end', id: 'answer' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ]),
                rawCall: { rawPrompt: null, rawSettings: {} },
              };
            },
          }),
          defaultOptions: {
            maxSteps: 3,
            isTaskComplete: {
              scorers: [
                {
                  id: 'confirmed-commitment',
                  name: 'Confirmed commitment',
                  run: async () => {
                    checked.push(generation);
                    return { score: checked.filter(g => g === generation).length > 1 ? 1 : 0 };
                  },
                } as any,
              ],
            },
          },
        }),
    });
    scenarios.push(scenario);
    const original = await scenario.start(({ agent, runId }) => agent.stream('Help me set a goal', { runId }));
    const drained = original.driven
      .then((result: any) =>
        (async () => {
          for await (const _ of result.fullStream) {
            /* drain original after release */
          }
        })(),
      )
      .catch(() => undefined);
    await gate.reached;
    const recovered = await scenario.restart(await original.checkpoint());
    expect(recovered.streamErrors).toEqual([]);
    expect(recovered.executionError).toBeUndefined();
    const recoveredChecks = [...checked];
    gate.release();
    await drained;
    expect(checked).toContain(1);
    expect(recoveredChecks).toContain(2);
    expect(recovered.chunkTypes).toContain('is-task-complete');
    expect(recovered.text).toBe('CONFIRMED');
  }, 30_000);
});
