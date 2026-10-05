/**
 * A durable run keeps its transcript in workflow state, persisted with every
 * snapshot. Messages recalled from memory are stored there as refs to their
 * memory rows; each step restores them, and a recovering process restores
 * them from memory storage.
 */
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import type { MastraDBMessage } from '../../message-list';
import { DurableStepIds } from '../constants';

const threadId = 'refs-thread';
const resourceId = 'refs-resource';
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

// A fresh module graph per process keeps module-level state (run registry,
// verified memory rows) from carrying over into recovery.
async function startProcess(messages: MastraDBMessage[], { requireApproval = false } = {}) {
  vi.resetModules();
  const [{ Mastra }, { InMemoryStore }, { MockMemory }, { Agent }, { createDurableAgent }] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../../memory/mock'),
    import('../../agent'),
    import('../create-durable-agent'),
  ]);

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage, options: { lastMessages: 20 } });
  await memory.createThread({ threadId, resourceId });
  await memory.saveMessages({ messages });

  const prompts: string[] = [];
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
        execute: async () => ({ found: true }),
      },
    },
  });
  const durableAgent = createDurableAgent({ agent });
  const mastra = new Mastra({
    agents: { durableAgent },
    storage,
    logger: false,
    recovery: { durableAgents: 'auto' },
  });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows, prompts, storage };
}

const refIds = (snapshot: WorkflowRunState | undefined) =>
  ((snapshot?.value as any)?.messageListState?.messages ?? [])
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

    const result = await durableAgent.stream('Look it up', { memory: { thread: threadId, resource: resourceId } });
    expect(await collectText(result)).toBe('done');

    const withTranscript = persisted.filter(row => (row.snapshot.value as any)?.messageListState);
    expect(withTranscript.length).toBeGreaterThan(0);
    for (const row of withTranscript) {
      expect(refIds(row.snapshot)).toEqual(['history-0', 'history-1', 'history-2', 'history-3']);
      expect(JSON.stringify(row.snapshot.value)).not.toContain(historyText(0));
    }

    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      for (let i = 0; i < 4; i++) expect(prompt).toContain(historyText(i));
    }
  });

  it('recovers in a fresh process with the stored version of recalled messages edited or deleted meanwhile', async () => {
    // Run to completion, copying the workflow store after every write.
    const original = await startProcess(history());
    const rows = new Map<string, SnapshotRow>();
    const checkpoints: SnapshotRow[][] = [];
    const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
    original.workflows.persistWorkflowSnapshot = async args => {
      rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
      checkpoints.push([...rows.values()].map(row => structuredClone(row)));
      return persist(args);
    };
    const result = await original.durableAgent.stream('Look it up', {
      memory: { thread: threadId, resource: resourceId },
    });
    expect(await collectText(result)).toBe('done');

    // Recover from every checkpoint that already stores the transcript as
    // refs, after history-0 was edited and history-1 deleted. Earlier
    // checkpoints restart from the run input, which carries its own copy.
    // Skips the nested start race excluded in durable-agent-crash-recovery.test.ts.
    const recoverable = checkpoints.filter(checkpoint => {
      const outer = checkpoint.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)?.snapshot;
      const innerSaved = checkpoint.some(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP);
      const nestedStartRace = DurableStepIds.AGENTIC_EXECUTION in (outer?.activeStepsPath ?? {}) && !innerSaved;
      return outer?.status === 'running' && !nestedStartRace && checkpoint.some(row => refIds(row.snapshot).length > 0);
    });
    expect(recoverable.length).toBeGreaterThan(0);

    const [first, , ...rest] = history();
    const edited = {
      ...first!,
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'edited meanwhile' }] },
    };
    const modelCalls: number[] = [];
    for (const checkpoint of recoverable) {
      const recovering = await startProcess([edited, ...rest]);
      for (const row of checkpoint) await recovering.workflows.persistWorkflowSnapshot(row);

      const recovered = await recovering.durableAgent.recover(result.runId);
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

  it('resumes an approval in the same process with the stored version of recalled messages edited or deleted while suspended', async () => {
    const { durableAgent, workflows, prompts, storage } = await startProcess(history(), { requireApproval: true });
    const memoryOption = { thread: threadId, resource: resourceId };

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
      const run = await workflows.getWorkflowRunById({
        runId: result.runId,
        workflowName: DurableStepIds.AGENTIC_LOOP,
      });
      expect(run?.snapshot).toMatchObject({ status: 'suspended' });
    });

    const memoryStore = (await storage.getStore('memory'))!;
    await memoryStore.updateMessages({
      messages: [{ id: 'history-0', content: { format: 2, parts: [{ type: 'text', text: 'edited meanwhile' }] } }],
    });
    await memoryStore.deleteMessages(['history-1']);

    const resumed = await durableAgent.approveToolCall({ runId: result.runId, toolCallId, memory: memoryOption });
    expect(await collectText(resumed)).toBe('done');

    expect(prompts).toHaveLength(2);
    const afterResume = prompts[1]!;
    expect(afterResume).toContain('edited meanwhile');
    expect(afterResume).not.toContain(historyText(0));
    expect(afterResume).not.toContain(historyText(1));
    expect(afterResume).toContain(historyText(2));
    expect(afterResume).toContain(historyText(3));
  });
});
