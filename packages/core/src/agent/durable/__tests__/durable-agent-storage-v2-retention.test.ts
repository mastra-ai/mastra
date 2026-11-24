/**
 * A DurableAgent run on storage v2 that suspends for approval every turn hands
 * each turn's nested run a new version of its state. The versions earlier turns
 * built on are not read again, so the run must not keep one per turn.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const TURNS = 6;

/** Calls the approval-gated tool `TURNS` times, then answers. */
function createModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls <= TURNS
          ? [
              { type: 'tool-call', toolCallId: `call-${calls}`, toolName: 'approvalTool', input: '{}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

describe('DurableAgent storage v2 retention', () => {
  const pubsub = new EventEmitterPubSub();

  afterEach(async () => {
    await pubsub.close();
  });

  it('keeps one state version handed to a nested run, not one per approval', async () => {
    const storage = new InMemoryStore();
    const agent = createDurableAgent({
      agent: new Agent({
        id: 'retention-agent',
        name: 'Retention Agent',
        instructions: 'Use the tool.',
        model: createModel() as LanguageModelV2,
        memory: new MockMemory(),
        tools: {
          approvalTool: createTool({
            id: 'approvalTool',
            description: 'approval-gated tool',
            inputSchema: z.object({}),
            requireApproval: true,
            execute: async () => 'approved',
          }),
        },
      }),
      pubsub,
      storageVersion: 2,
    });
    new Mastra({ logger: false, storage, agents: { agent } });
    const workflows = await storage.getStore('workflows');
    const loopEntries = () =>
      [...(workflows as any).db.workflowRunEntries.entries()]
        .filter(([key]) => key.startsWith(DurableStepIds.AGENTIC_LOOP))
        .flatMap(([, entries]) => entries as { kind: string }[]);
    const count = (kind: string) => loopEntries().filter(entry => entry.kind === kind).length;

    const memory = { thread: 'retention', resource: 'r' };
    const initial = await agent.stream('Go', { memory, maxSteps: TURNS + 2 });
    for await (const chunk of initial.fullStream) if (chunk.type === 'tool-call-approval') break;

    let finish: any;
    const retained = () => ({ draft: count('state-draft'), state: count('state'), patch: count('state-patch') });
    for (let turn = 1; turn <= TURNS; turn++) {
      // Without dropping them, the loop run gains a draft, a full state and a patch per turn.
      // Poll one settled view of all three: waiting on the draft alone can read the others mid-write.
      await expect
        .poll(() => {
          const { draft, state, patch } = retained();
          return draft === 1 && state <= 2 && patch <= 2;
        })
        .toBe(true);

      const resumed: any = await agent.approveToolCall({
        runId: initial.runId,
        toolCallId: `call-${turn}`,
        memory,
        onFinish: (event: any) => void (finish = event),
      });
      for await (const chunk of resumed.fullStream) if (chunk.type === 'tool-call-approval') break;
    }

    // The steps of earlier turns come from the run's stored state.
    await expect.poll(() => finish).toBeDefined();
    expect(finish.text).toBe('done');
    expect(finish.steps.map((step: any) => step.finishReason)).toEqual([...Array(TURNS).fill('tool-calls'), 'stop']);
  }, 30000);
});
