/**
 * Restarting an agent run in the middle of parallel tool calls (#26214).
 *
 * The model asks for three tool calls in one step. Calls 0 and 2 finish, call 1
 * is still running when the process "crashes". The restarted run must only run
 * call 1 again: tools can have side effects (charges, emails), so a finished
 * call must not be repeated.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Checkpoint, Gate } from './restart-harness';
import { createGate, createRestartScenario, DEFAULT_TIMEOUT_MS } from './restart-harness';

let llm: LLMock;
const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    {
      toolCalls: [0, 1, 2].map(index => ({ id: `call_${index}`, name: 'charge', arguments: { index } })),
    },
  );
  llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'all charged' });
});

afterAll(async () => {
  await llm.stop();
});

afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  for (const scenario of scenarios.splice(0)) await scenario.stop();
});

/** Indexes of the tool calls a checkpoint records as finished while the run is still going. */
function finishedToolCalls(checkpoint: Checkpoint): number[] {
  const found = new Set<number>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const progress = (value as { metadata?: { foreachProgress?: Record<string, unknown> } }).metadata?.foreachProgress;
    if (progress) for (const key of Object.keys(progress)) found.add(Number(key));
    for (const child of Object.values(value)) visit(child);
  };
  for (const row of checkpoint.rows) visit(row.snapshot.context);
  return [...found].sort();
}

describe.each(['durable', 'evented'] as const)('%s agent: restart during parallel tool calls', kind => {
  it('runs only the unfinished tool call again', async () => {
    const runId = `parallel-tools-${kind}`;
    const hold = createGate();
    gates.push(hold);
    const charges: { generation: number; index: number }[] = [];
    const scenario = createRestartScenario({
      kind,
      runId,
      build: ({ core, generation }) =>
        new core.Agent({
          id: 'charge-agent',
          name: 'charge-agent',
          instructions: 'Charge every card.',
          model: createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o-mini'),
          tools: {
            charge: core.createTool({
              id: 'charge',
              description: 'Charges a card',
              inputSchema: z.object({ index: z.number() }),
              execute: async ({ index }) => {
                charges.push({ generation, index });
                // Call 1 stays running in the first process until the crash.
                if (generation === 1 && index === 1) await hold.wait();
                return { charged: index };
              },
            }),
          },
        }),
    });
    scenarios.push(scenario);

    const original = await scenario.start(({ agent }) => agent.stream('Charge the cards', { runId }));
    await hold.reached;
    await expect.poll(() => charges.filter(c => c.index !== 1).length, { timeout: DEFAULT_TIMEOUT_MS }).toBe(2);

    // The crash happens once calls 0 and 2 have been checkpointed as finished.
    // Without that checkpoint this times out and the restart below re-runs them.
    let checkpoint = await original.checkpoint();
    const deadline = Date.now() + 3_000;
    while (kind === 'durable' && finishedToolCalls(checkpoint).length < 2 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
      checkpoint = await original.checkpoint();
    }

    const restarted = await scenario.restart(checkpoint);
    expect(restarted.executionError).toBeUndefined();
    expect(restarted.streamErrors).toEqual([]);
    expect(restarted.text).toBe('all charged');
    expect(charges.filter(c => c.generation === 2).map(c => c.index)).toEqual([1]);
  }, 30_000);
});
