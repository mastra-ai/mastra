/**
 * THROWAWAY battery-1 sanity check (evented-engine enablement assessment).
 *
 * Verifies that EventedAgent's durable agentic loop actually runs on the
 * evented execution engine: the workflow instance is an evented-engine
 * workflow, and execution flows through the WorkflowEventProcessor (a pubsub
 * spy sees workflow.start / step events on the 'workflows' topic during a
 * run), not just streaming.
 *
 * Delete after the assessment battery is complete.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

describe('EventedAgent evented-engine sanity', () => {
  it('runs the durable agentic loop on the evented execution engine via the WEP', async () => {
    const baseAgent = new Agent({
      id: 'sanity-agent',
      name: 'Sanity Agent',
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('Hello!'),
    });
    // No custom pubsub: the agent adopts mastra.pubsub on registration, so
    // the evented engine, workers, and stream adapter share one transport.
    const agent = createEventedAgent({ agent: baseAgent });
    const mastra = new Mastra({
      agents: { 'sanity-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
    });

    // 1. The loop workflow is an evented-engine workflow.
    const workflow = agent.getWorkflow();
    expect((workflow as any).engineType).toBe('evented');

    // 2. Execution flows through the workflows topic (WEP), not in-process.
    const seen: string[] = [];
    await mastra.pubsub.subscribe('workflows', (event: any) => {
      if (typeof event?.type === 'string') seen.push(event.type);
    });

    const { output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();

    await vi.waitFor(() => {
      expect(seen).toContain('workflow.start');
      expect(seen.some(t => t.startsWith('workflow.step'))).toBe(true);
    });

    cleanup();
  }, 30_000);

  it('diagnostic: custom agent pubsub — does execution complete even if streaming is split?', async () => {
    const { EventEmitterPubSub } = await import('../../../events/event-emitter');
    const { DurableStepIds } = await import('../constants');

    const baseAgent = new Agent({
      id: 'sanity-agent-2',
      name: 'Sanity Agent 2',
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('Hello!'),
    });
    // Custom pubsub ≠ mastra.pubsub — mirrors evented-terminal-cleanup.test.ts.
    const customPubsub = new EventEmitterPubSub();
    const agent = createEventedAgent({ agent: baseAgent, pubsub: customPubsub });
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'sanity-agent-2': agent as any },
      logger: false,
      storage,
    });

    const seen: string[] = [];
    await mastra.pubsub.subscribe('workflows', (event: any) => {
      if (typeof event?.type === 'string') seen.push(event.type);
    });

    // Do NOT consume the stream — we only care whether execution finishes.
    const { runId, cleanup } = await agent.stream('Hi');

    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(
      async () => {
        expect(seen).toContain('workflow.start');
        expect(await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP })).toBeNull();
        expect(
          await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_EXECUTION }),
        ).toBeNull();
      },
      { timeout: 15_000 },
    );

    cleanup();
    await customPubsub.close();
  }, 30_000);
});
