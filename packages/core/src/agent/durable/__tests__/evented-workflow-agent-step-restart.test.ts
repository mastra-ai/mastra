/**
 * Port of harness case T54 (wf-agent-restart): an evented workflow whose agent
 * step is cut off while the agent's tool is running, then restarted with
 * `run.restart()` in a fresh module graph. The harness kills the process with
 * SIGKILL; here graph 1 is abandoned at a gate and graph 2 restarts from a copy
 * of its workflow rows.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createGate, createRestartScenario, findRow } from './restart-harness';
import type { Gate } from './restart-harness';

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
  for (const gate of gates.splice(0)) gate.release();
});

/** Calls tool `step` for n = 1..count, one per model turn, then answers. Pure function of the prompt. */
function createStepModel(count: number) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const done = prompt
        .filter(message => message.role === 'tool')
        .flatMap(message => message.content as Array<{ type: string }>)
        .filter(part => part.type === 'tool-result').length;
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const body =
        done < count
          ? [
              {
                type: 'tool-call' as const,
                toolCallId: `call-${done + 1}`,
                toolName: 'step',
                input: JSON.stringify({ n: done + 1 }),
              },
              { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
            ]
          : [
              { type: 'text-start' as const, id: 't' },
              { type: 'text-delta' as const, id: 't', delta: `finished ${done} steps` },
              { type: 'text-end' as const, id: 't' },
              { type: 'finish' as const, finishReason: 'stop' as const, usage },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
          ...body,
        ]),
      };
    },
  });
}

describe('T54 evented workflow restart after a crash inside an agent step', () => {
  it('restarts the agent step and reaches the interrupted tool call', async () => {
    const gate = createGate();
    gates.push(gate);
    const log: Array<{ generation: number; event: string; n: number }> = [];
    const runId = 't54-mid-tool';

    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core, generation }) => {
        const agent = new core.Agent({
          id: 't54-agent',
          name: 't54-agent',
          instructions: 'Follow the script.',
          model: createStepModel(2),
          tools: {
            step: core.createTool({
              id: 'step',
              description: 'Perform numbered step n.',
              inputSchema: z.object({ n: z.number() }),
              execute: async ({ n }) => {
                log.push({ generation, event: 'start', n });
                if (generation === 1 && n === 2) await gate.wait();
                log.push({ generation, event: 'commit', n });
                return { done: n };
              },
            }),
          },
        });
        return core
          .createEventedWorkflow({
            id: 't54-wf',
            inputSchema: z.object({ prompt: z.string() }),
            outputSchema: z.object({ text: z.string() }),
          })
          .then(core.createEventedStep(agent) as any)
          .commit();
      },
    });
    scenarios.push(scenario);

    const original = await scenario.start(async ({ workflow }) => {
      const run = await workflow.createRun({ runId });
      return run.start({ inputData: { prompt: 'go' } });
    });
    await Promise.race([
      gate.reached,
      original.settled.then(() => {
        throw new Error('not exercised: run ended before the tool call at step 2');
      }),
    ]);
    const checkpoint = await original.checkpoint();
    expect(findRow(checkpoint, 't54-wf', runId)?.snapshot.status).toBe('running');

    const { result } = await scenario.restart(checkpoint);
    const gen2 = log.filter(e => e.generation === 2).map(e => `${e.event}:${e.n}`);
    expect({ status: result.status, error: result.error?.message }).toEqual({ status: 'success', error: undefined });
    expect(gen2).toContain('commit:2');
    expect(result.result?.text).toMatch(/finished 2 steps/);
  }, 30_000);
});
