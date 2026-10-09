import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

const mismatch = { id: 'AGENT_MEMORY_THREAD_RESOURCE_MISMATCH' };

function textModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: 'ok' },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function keyed(resourceId: string) {
  const ctx = new RequestContext();
  ctx.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return ctx;
}

async function seed(
  store: InMemoryStore,
  runId: string,
  agentId: string,
  memory?: { threadId: string; resourceId: string },
) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    resourceId: memory?.resourceId,
    snapshot: {
      runId,
      status: 'suspended',
      value: {},
      context: {
        input: {
          __workflowKind: 'durable-agent',
          runId,
          agentId,
          messageListState: memory ? { memoryInfo: memory } : {},
          state: memory ?? {},
        },
      },
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState,
  });
}

describe('durable tool-control caller resource guard', () => {
  let pubsub: EventEmitterPubSub;
  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });
  afterEach(async () => {
    await pubsub.close();
  });

  function build() {
    const store = new InMemoryStore();
    const base = new Agent({
      id: 'guard-agent',
      name: 'Guard Agent',
      instructions: 'x',
      model: textModel() as LanguageModelV2,
    });
    const agent = createDurableAgent({ agent: base, pubsub });
    void new Mastra({ agents: { guardAgent: agent }, storage: store, logger: false });
    const resume = vi.spyOn(agent, 'resume');
    return { store, agent, resume };
  }

  it('rejects a keyed approve/decline when the run cannot be resolved, before resume', async () => {
    const { agent, resume } = build();
    for (const call of [
      () => agent.approveToolCall({ runId: 'ghost-run', requestContext: keyed('mallory') }),
      () => agent.declineToolCall({ runId: 'ghost-run', requestContext: keyed('mallory') }),
      () => agent.approveToolCallGenerate({ runId: 'ghost-run', requestContext: keyed('mallory') }),
      () => agent.declineToolCallGenerate({ runId: 'ghost-run', requestContext: keyed('mallory') }),
    ]) {
      const error = await call().catch(e => e);
      expect(error).toMatchObject(mismatch);
      expect(error.message).toBe(
        'Resource "mallory" was provided but the resource that owns run "ghost-run" could not be resolved. A thread can only be used by the resource that owns it.',
      );
      expect(error.message).not.toContain('undefined');
      expect(error.message).not.toContain('this session');
    }
    expect(resume).not.toHaveBeenCalled();
  });

  it('keeps the existing missing-run error for unkeyed callers', async () => {
    const { agent } = build();
    await expect(agent.approveToolCall({ runId: 'ghost-run' })).rejects.toThrow(
      'No registry entry found for run ghost-run. Cannot resume.',
    );
  });

  it('rejects a mismatched caller on a persisted run, leaving it suspended', async () => {
    const { store, agent, resume } = build();
    await seed(store, 'alice-run', agent.id, { threadId: 't1', resourceId: 'alice' });
    await expect(agent.approveToolCall({ runId: 'alice-run', requestContext: keyed('mallory') })).rejects.toMatchObject(
      mismatch,
    );
    await expect(agent.declineToolCall({ runId: 'alice-run', requestContext: keyed('mallory') })).rejects.toMatchObject(
      mismatch,
    );
    expect(resume).not.toHaveBeenCalled();
    expect(agent.runRegistry.has('alice-run')).toBe(false);
    const row = await (await store.getStore('workflows'))!.getWorkflowRunById({
      runId: 'alice-run',
      workflowName: DurableStepIds.AGENTIC_LOOP,
    });
    expect(row).toBeTruthy();
  });

  it('accepts a matching caller on a re-hydrated run', async () => {
    const { store, agent, resume } = build();
    await seed(store, 'alice-run', agent.id, { threadId: 't1', resourceId: 'alice' });
    const result = await agent.approveToolCall({ runId: 'alice-run', requestContext: keyed('alice') });
    expect(resume).toHaveBeenCalledOnce();
    expect(result.runId).toBe('alice-run');
    (result as any).cleanup?.();
  });

  it('accepts a keyed caller on a memory-less run (lookup succeeded, no resource)', async () => {
    const { store, agent, resume } = build();
    await seed(store, 'memless-run', agent.id);
    await agent.approveToolCall({ runId: 'memless-run', requestContext: keyed('alice') }).catch(e => {
      expect(e).not.toMatchObject(mismatch);
    });
    expect(resume).toHaveBeenCalledOnce();
  });

  it('guards a standalone `durable: true` agent through the wrapper bridge', async () => {
    const raw = new Agent({
      id: 'bridge-agent',
      name: 'Bridge Agent',
      instructions: 'x',
      model: textModel() as LanguageModelV2,
      durable: true,
    });
    // The in-process path would throw AGENT_RESUME_NO_SNAPSHOT_FOUND; the
    // unresolved-run mismatch proves the call reached the durable override.
    const error = await raw.approveToolCall({ runId: 'ghost-run', requestContext: keyed('mallory') }).catch(e => e);
    expect(error).toMatchObject(mismatch);
    expect(error.message).toContain('the resource that owns run "ghost-run" could not be resolved');
  });
});
