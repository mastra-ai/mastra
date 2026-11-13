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

describe.each(['durable'] as const)('recovered %s run default lifecycle callbacks', kind => {
  it('calls defaultOptions.onFinish after recovery', async () => {
    const gate = createGate();
    gates.push(gate);
    const finishedGenerations: number[] = [];
    const scenario = createRestartScenario({
      kind,
      runId: `recover-default-callbacks-${kind}`,
      build: ({ core, generation }) =>
        new core.Agent({
          id: 'recover-default-callbacks',
          name: 'Recover default callbacks',
          instructions: 'Answer.',
          model: new MockLanguageModelV2({
            doStream: async () => {
              if (generation === 1) await gate.wait();
              return {
                stream: convertArrayToReadableStream([
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'response', modelId: 'script', timestamp: new Date(0) },
                  { type: 'text-start', id: 'answer' },
                  { type: 'text-delta', id: 'answer', delta: 'answer' },
                  { type: 'text-end', id: 'answer' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ]),
                rawCall: { rawPrompt: null, rawSettings: {} },
              };
            },
          }),
          defaultOptions: {
            onFinish: () => {
              finishedGenerations.push(generation);
            },
          },
        }),
    });
    scenarios.push(scenario);
    const original = await scenario.start(({ agent, runId }) => agent.stream('hi', { runId }));
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
    expect(recovered.text).toBe('answer');
    expect(finishedGenerations).toContain(2);
    gate.release();
    await drained;
  }, 30_000);
});
