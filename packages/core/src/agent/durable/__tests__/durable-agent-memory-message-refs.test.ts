/**
 * A durable run keeps its transcript in workflow state, persisted with every
 * snapshot. Messages recalled from memory are stored there as refs to their
 * memory rows; each step restores them, and a recovering process restores
 * them from memory storage.
 */
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import type { MastraDBMessage } from '../../message-list';
import { DurableStepIds } from '../constants';

const threadId = 'refs-thread';
const resourceId = 'refs-resource';
const memoryOption = { thread: threadId, resource: resourceId };
const historyText = (i: number) => `history turn ${i}: ${'h'.repeat(500)}`;
const history = (): MastraDBMessage[] =>
  Array.from({ length: 4 }, (_, i) => ({
    id: `history-${i}`,
    threadId,
    resourceId,
    role: i % 2 === 0 ? 'user' : 'assistant',
    createdAt: new Date(1_000 + i * 1_000),
    content: { format: 2, parts: [{ type: 'text', text: historyText(i) }] },
  }));

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };
const allHistoryIds = history().map(message => message.id);
type Engine = 'default' | 'evented';
const engines: Engine[] = ['default', 'evented'];

// Decides from the transcript, so a recovering process makes the same call
// the original one made: one tool round, then text.
function createModel(prompts: string[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      prompts.push(JSON.stringify(prompt));
      const answered = prompt.some(message => message.role === 'tool');
      const parts = answered
        ? [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]
        : [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'lookup', input: '{"query":"a"}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${prompts.length}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
}

const stopProcesses: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(stopProcesses.splice(0).map(stop => stop()));
});

// A fresh module graph per process keeps module-level state (run registry,
// verified memory rows) from carrying over into recovery.
async function startProcess(
  messages: MastraDBMessage[],
  {
    requireApproval = false,
    engine = 'default',
    onLookup,
  }: { requireApproval?: boolean; engine?: Engine; onLookup?: () => Promise<void> } = {},
) {
  vi.resetModules();
  const [
    { Mastra },
    { InMemoryStore },
    { MockMemory },
    { Agent },
    { createDurableAgent },
    { createEventedAgent },
    { EventEmitterPubSub },
    transcripts,
  ] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../../memory/mock'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../create-evented-agent'),
    import('../../../events/event-emitter'),
    import('../workflows/shared/message-list-state'),
  ]);
  transcripts.__setMidRunLoadRetryDelaysForTests([1, 1, 1]);

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
  await memory.createThread({ threadId, resourceId });
  await memory.saveMessages({ messages });

  const prompts: string[] = [];
  let toolExecutions = 0;
  const agent = new Agent({
    id: 'refs-agent',
    name: 'refs-agent',
    instructions: 'Use your tools.',
    model: createModel(prompts),
    memory,
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ query: z.string() }),
        requireApproval,
        execute: async () => {
          toolExecutions++;
          await onLookup?.();
          return { found: true };
        },
      },
    },
  });
  const pubsub = engine === 'evented' ? new EventEmitterPubSub() : undefined;
  const durableAgent = pubsub ? createEventedAgent({ agent, pubsub }) : createDurableAgent({ agent });
  const mastra = new Mastra({
    agents: { durableAgent },
    storage,
    ...(pubsub ? { pubsub } : {}),
    logger: false,
    recovery: { durableAgents: 'auto' },
  });
  if (pubsub) {
    stopProcesses.push(async () => {
      await mastra.stopWorkers();
      await pubsub.close();
    });
  }
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows, prompts, storage, transcripts, toolExecutions: () => toolExecutions };
}

// Starts a run whose tool drops this process's loaded rows and then makes
// memory storage reject, so the step after the tool has to load the recalled
// messages from storage mid-run, as a step on another worker would.
async function startColdCacheRun(engine: Engine, failures: number | 'always') {
  const runId = `cold-cache-${engine}-${failures}`;
  let listMessagesById: MockInstance | undefined;
  const process = await startProcess(history(), {
    engine,
    onLookup: async () => {
      process.transcripts.releaseMessageListState({ state: undefined, getInitData: () => ({ runId }) });
      const memoryStore = (await process.storage.getStore('memory'))!;
      listMessagesById = vi.spyOn(memoryStore, 'listMessagesById');
      const outage = new Error('memory storage down');
      if (failures === 'always') listMessagesById.mockRejectedValue(outage);
      else for (let i = 0; i < failures; i++) listMessagesById.mockRejectedValueOnce(outage);
    },
  });
  const result = await process.durableAgent.stream('Look it up', { memory: memoryOption, runId });
  return { ...process, runId, result, loads: () => listMessagesById?.mock.calls.length ?? 0 };
}

// Runs to completion, copying the workflow store after every write, and returns
// the copies a crashed process could recover from with the transcript stored as
// refs. Earlier copies restart from the run input, which carries its own copy.
// Skips the nested start race excluded in durable-agent-crash-recovery.test.ts.
async function recoverableCheckpoints() {
  const original = await startProcess(history());
  const rows = new Map<string, SnapshotRow>();
  const checkpoints: SnapshotRow[][] = [];
  const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
  original.workflows.persistWorkflowSnapshot = async args => {
    rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
    checkpoints.push([...rows.values()].map(row => structuredClone(row)));
    return persist(args);
  };
  const result = await original.durableAgent.stream('Look it up', { memory: memoryOption });
  expect(await collectText(result)).toBe('done');

  const recoverable = checkpoints.filter(checkpoint => {
    const outer = checkpoint.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)?.snapshot;
    const innerSaved = checkpoint.some(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP);
    const nestedStartRace = DurableStepIds.AGENTIC_EXECUTION in (outer?.activeStepsPath ?? {}) && !innerSaved;
    return outer?.status === 'running' && !nestedStartRace && checkpoint.some(row => refIds(row.snapshot).length > 0);
  });
  expect(recoverable.length).toBeGreaterThan(0);
  return { runId: result.runId, recoverable };
}

async function streamUntilApproval(
  durableAgent: Awaited<ReturnType<typeof startProcess>>['durableAgent'],
  workflows: Awaited<ReturnType<typeof startProcess>>['workflows'],
) {
  const result = await durableAgent.stream('Look it up', { memory: memoryOption });
  let toolCallId: string | undefined;
  for await (const chunk of result.fullStream as AsyncIterable<any>) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
      break;
    }
  }
  expect(toolCallId).toBe('call-1');
  await vi.waitFor(async () => {
    expect(await outerSnapshot(workflows, result.runId)).toMatchObject({ status: 'suspended' });
  });
  return { runId: result.runId, toolCallId: toolCallId! };
}

async function outerSnapshot(workflows: Awaited<ReturnType<typeof startProcess>>['workflows'], runId: string) {
  const run = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
  return run?.snapshot;
}

// The default engine keeps workflow state in `value`, the evented engine in `context.__state`.
const workflowState = (snapshot: WorkflowRunState | undefined, engine: Engine): any =>
  engine === 'evented' ? (snapshot?.context as any)?.__state : snapshot?.value;

const refIds = (snapshot: WorkflowRunState | undefined, engine: Engine = 'default') =>
  (workflowState(snapshot, engine)?.messageListState?.messages ?? [])
    .filter((m: any) => m.__ref === 'memory')
    .map((m: any) => m.id);

async function collectText(stream: { fullStream: AsyncIterable<any> }) {
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
    if (chunk.type === 'finish' && !text) text = String(chunk.payload.output?.text ?? '');
  }
  return text;
}

describe('memory-recalled messages in durable runs', () => {
  it('persists recalled messages as refs in workflow state and restores them for every model call', async () => {
    const { durableAgent, workflows, prompts } = await startProcess(history());
    const persisted: SnapshotRow[] = [];
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    workflows.persistWorkflowSnapshot = async args => {
      persisted.push(structuredClone(args));
      return persist(args);
    };

    const result = await durableAgent.stream('Look it up', { memory: memoryOption });
    expect(await collectText(result)).toBe('done');

    const withTranscript = persisted.filter(row => (row.snapshot.value as any)?.messageListState);
    expect(withTranscript.length).toBeGreaterThan(0);
    for (const row of withTranscript) {
      expect(refIds(row.snapshot)).toEqual(allHistoryIds);
      expect(JSON.stringify(row.snapshot.value)).not.toContain(historyText(0));
    }

    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      for (let i = 0; i < 4; i++) expect(prompt).toContain(historyText(i));
    }
  });

  it('recovers in a fresh process with the stored version of recalled messages edited or deleted meanwhile', async () => {
    // Recover from every checkpoint after history-0 was edited and history-1 deleted.
    const { runId, recoverable } = await recoverableCheckpoints();

    const [first, , ...rest] = history();
    const edited = {
      ...first!,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'edited meanwhile' }] },
    };
    const modelCalls: number[] = [];
    for (const checkpoint of recoverable) {
      const recovering = await startProcess([edited, ...rest]);
      for (const row of checkpoint) await recovering.workflows.persistWorkflowSnapshot(row);

      const recovered = await recovering.durableAgent.recover(runId);
      expect(await collectText(recovered)).toBe('done');

      modelCalls.push(recovering.prompts.length);
      for (const prompt of recovering.prompts) {
        expect(prompt).toContain('edited meanwhile');
        expect(prompt).not.toContain(historyText(0));
        expect(prompt).not.toContain(historyText(1));
        expect(prompt).toContain(historyText(2));
        expect(prompt).toContain(historyText(3));
      }
    }
    // Covers recovery that calls the model again and recovery that only finishes up.
    expect(modelCalls).toContain(1);
    expect(modelCalls).toContain(0);
  }, 60_000);

  it.each(engines)(
    'resumes an approval in the same process with the stored version of recalled messages edited or deleted while suspended (%s engine)',
    async engine => {
      const { durableAgent, workflows, prompts, storage } = await startProcess(history(), {
        requireApproval: true,
        engine,
      });
      const { runId, toolCallId } = await streamUntilApproval(durableAgent, workflows);
      expect(refIds(await outerSnapshot(workflows, runId), engine)).toEqual(allHistoryIds);

      const memoryStore = (await storage.getStore('memory'))!;
      await memoryStore.updateMessages({
        messages: [{ id: 'history-0', content: { format: 2, parts: [{ type: 'text', text: 'edited meanwhile' }] } }],
      });
      await memoryStore.deleteMessages(['history-1']);
      const listMessagesById = vi.spyOn(memoryStore, 'listMessagesById');

      const resumed = await durableAgent.approveToolCall({ runId, toolCallId, memory: memoryOption });
      expect(await collectText(resumed)).toBe('done');
      // Loaded once before the resume runs anything; the steps never read storage.
      expect(listMessagesById).toHaveBeenCalledTimes(1);

      expect(prompts).toHaveLength(2);
      const afterResume = prompts[1]!;
      expect(afterResume).toContain('edited meanwhile');
      expect(afterResume).not.toContain(historyText(0));
      expect(afterResume).not.toContain(historyText(1));
      expect(afterResume).toContain(historyText(2));
      expect(afterResume).toContain(historyText(3));
    },
  );

  it.each(engines)(
    'keeps an approval suspended for a retry when memory storage cannot load the recalled messages (%s engine)',
    async engine => {
      const { durableAgent, workflows, prompts, storage, toolExecutions } = await startProcess(history(), {
        requireApproval: true,
        engine,
      });
      const { runId, toolCallId } = await streamUntilApproval(durableAgent, workflows);
      const suspended = await outerSnapshot(workflows, runId);
      expect(refIds(suspended, engine)).toEqual(allHistoryIds);
      expect(JSON.stringify(workflowState(suspended, engine))).not.toContain(historyText(0));

      const memoryStore = (await storage.getStore('memory'))!;
      const listMessagesById = vi
        .spyOn(memoryStore, 'listMessagesById')
        .mockRejectedValueOnce(new Error('memory storage temporarily unavailable'));

      await expect(durableAgent.approveToolCall({ runId, toolCallId, memory: memoryOption })).rejects.toThrow(
        'memory storage temporarily unavailable',
      );
      expect(listMessagesById).toHaveBeenCalledTimes(1);
      expect(toolExecutions()).toBe(0);
      expect(await outerSnapshot(workflows, runId)).toMatchObject({ status: 'suspended' });

      const resumed = await durableAgent.approveToolCall({ runId, toolCallId, memory: memoryOption });
      expect(await collectText(resumed)).toBe('done');
      expect(listMessagesById).toHaveBeenCalledTimes(2);
      expect(toolExecutions()).toBe(1);
      expect(prompts).toHaveLength(2);
      for (let i = 0; i < 4; i++) expect(prompts[1]).toContain(historyText(i));
    },
  );

  it.each(engines)(
    'retries a memory storage failure when a step loads the recalled messages mid-run (%s engine)',
    async engine => {
      const run = await startColdCacheRun(engine, 2);
      expect(await collectText(run.result)).toBe('done');
      // Two rejected loads, then the retry that succeeded.
      expect(run.loads()).toBe(3);
      expect(run.toolExecutions()).toBe(1);
      expect(run.prompts).toHaveLength(2);
      for (let i = 0; i < 4; i++) expect(run.prompts[1]).toContain(historyText(i));
    },
  );

  it.each(engines)(
    'fails the run once the retries run out when memory storage stays down mid-run (%s engine)',
    async engine => {
      const run = await startColdCacheRun(engine, 'always');
      const errors: string[] = [];
      let text = '';
      for await (const chunk of run.result.fullStream as AsyncIterable<any>) {
        if (chunk.type === 'error') errors.push(String(chunk.payload?.error?.message ?? chunk.payload?.error));
        if (chunk.type === 'text-delta') text += chunk.payload.text;
      }
      expect(errors.join('\n')).toContain('memory storage down');
      expect(text).toBe('');
      // The first load after the tool and its three retries.
      expect(run.loads()).toBe(4);
      expect(run.toolExecutions()).toBe(1);
      expect(run.prompts).toHaveLength(1);
    },
  );

  it('leaves a crashed run for the next recovery when memory storage cannot load the recalled messages', async () => {
    const { runId, recoverable } = await recoverableCheckpoints();
    const recovering = await startProcess(history());
    for (const row of recoverable[0]!) await recovering.workflows.persistWorkflowSnapshot(row);

    const memoryStore = (await recovering.storage.getStore('memory'))!;
    const listMessagesById = vi
      .spyOn(memoryStore, 'listMessagesById')
      .mockRejectedValueOnce(new Error('memory storage temporarily unavailable'));

    await expect(recovering.durableAgent.recover(runId)).rejects.toThrow('memory storage temporarily unavailable');
    expect(listMessagesById).toHaveBeenCalledTimes(1);
    expect(await outerSnapshot(recovering.workflows, runId)).toMatchObject({ status: 'running' });

    const recovered = await recovering.durableAgent.recover(runId);
    expect(await collectText(recovered)).toBe('done');
    expect(listMessagesById).toHaveBeenCalledTimes(2);
    for (const prompt of recovering.prompts) {
      for (let i = 0; i < 4; i++) expect(prompt).toContain(historyText(i));
    }
  }, 30_000);
});
