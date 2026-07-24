import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { DurableAgent } from '../durable-agent';
import { EventedAgent } from '../evented-agent';
import { globalRunRegistry } from '../run-registry';
import type { DurableAgenticWorkflowInput } from '../types';

class TestDurableAgent extends DurableAgent {
  executeWorkflowForTest(runId: string, workflowInput: DurableAgenticWorkflowInput) {
    return this.executeWorkflow(runId, workflowInput);
  }
}

class TestEventedAgent extends EventedAgent {
  executeWorkflowForTest(runId: string, workflowInput: DurableAgenticWorkflowInput) {
    return this.executeWorkflow(runId, workflowInput);
  }
}

function createTextModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  }) as LanguageModelV2;
}

function createBaseAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'Test actor forwarding',
    model: createTextModel(),
  });
}

const runIds: string[] = [];
const pubsubs: EventEmitterPubSub[] = [];

function createPubsub() {
  const pubsub = new EventEmitterPubSub();
  pubsubs.push(pubsub);
  return pubsub;
}

afterEach(async () => {
  for (const runId of runIds.splice(0)) {
    globalRunRegistry.delete(runId);
  }
  await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  vi.restoreAllMocks();
});

describe('DurableAgent workflow actor forwarding', () => {
  it('passes the initial actor into the core durable workflow', async () => {
    const actor = { actorKind: 'system' as const, sourceWorkflow: 'initial-run' };
    const agent = new TestDurableAgent({ agent: createBaseAgent('core-start-actor'), pubsub: createPubsub() });
    const prepared = await agent.prepare('hello', { actor });
    runIds.push(prepared.runId);
    const start = vi.fn().mockResolvedValue({ status: 'suspended' });
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn().mockResolvedValue({ start }),
    } as any);

    await agent.executeWorkflowForTest(prepared.runId, prepared.workflowInput);

    expect(start).toHaveBeenCalledWith(expect.objectContaining({ actor }));
  });

  it('passes the initial actor into the evented durable workflow', async () => {
    const actor = { actorKind: 'system' as const, sourceWorkflow: 'initial-run' };
    const agent = new TestEventedAgent({ agent: createBaseAgent('evented-start-actor'), pubsub: createPubsub() });
    const prepared = await agent.prepare('hello', { actor });
    runIds.push(prepared.runId);
    const startAsync = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn().mockResolvedValue({ startAsync }),
    } as any);

    await agent.executeWorkflowForTest(prepared.runId, prepared.workflowInput);

    expect(startAsync).toHaveBeenCalledWith(expect.objectContaining({ actor }));
  });

  it.each([
    {
      name: 'uses a newly supplied resume actor',
      actor: { actorKind: 'system' as const, sourceWorkflow: 'approval-resume' },
    },
    {
      name: 'does not reuse the initial actor when resume omits it',
      actor: undefined,
    },
  ])('$name', async ({ actor }) => {
    const initialActor = { actorKind: 'system' as const, sourceWorkflow: 'initial-run' };
    const agent = new TestDurableAgent({
      agent: createBaseAgent(`core-resume-actor-${actor ? 'new' : 'none'}`),
      pubsub: createPubsub(),
    });
    vi.spyOn(agent as any, 'requireAgentExecutionFGA').mockResolvedValue(undefined);
    const prepared = await agent.prepare('hello', { actor: initialActor });
    runIds.push(prepared.runId);
    const resume = vi.fn().mockResolvedValue({ status: 'suspended' });
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn().mockResolvedValue({ resume }),
    } as any);

    const result = await agent.resume(prepared.runId, { approved: true }, actor ? { actor } : {});
    await vi.waitFor(() => expect(resume).toHaveBeenCalled());

    expect(resume).toHaveBeenCalledWith(expect.objectContaining({ actor }));
    result.cleanup();
  });
});
