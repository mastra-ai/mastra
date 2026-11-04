/**
 * Concurrent runs of one DurableAgent share its iteration workflow instance.
 * Each run's nested pending snapshot must still hold that run's own
 * conversation: a crash before the nested run's first step restarts from it,
 * and a snapshot holding a sibling's conversation would send that conversation
 * to the model and save the reply into the sibling's thread.
 */

import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import { DurableStepIds } from '../constants';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
type Letter = (typeof LETTERS)[number];
const secret = (letter: Letter) => `secret-${letter}`;
const secretsIn = (value: unknown) => {
  const json = JSON.stringify(value ?? null);
  return LETTERS.filter(letter => json.includes(secret(letter)));
};
const perRun = <T>(map: (letter: Letter) => T) => Object.fromEntries(LETTERS.map(letter => [letter, map(letter)]));

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };

// One tool call, then text once the tool has answered.
function createModel(prompts: string[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: LanguageModelV2Prompt }) => {
      prompts.push(JSON.stringify(prompt));
      const parts = prompt.some(message => message.role === 'tool')
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
// recovery claims) from leaking between the original runs and recovery.
async function startProcess() {
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
  for (const letter of LETTERS) {
    await memory.createThread({ threadId: `thread-${letter}`, resourceId: `resource-${letter}` });
  }

  const prompts: string[] = [];
  const agent = new Agent({
    id: 'concurrent-agent',
    name: 'concurrent-agent',
    instructions: 'Use your tools.',
    model: createModel(prompts),
    memory,
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ query: z.string() }),
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
  return { durableAgent, workflows, memory, prompts };
}

async function collectText(stream: { fullStream: AsyncIterable<any> }) {
  let text = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return text;
}

describe('DurableAgent concurrent runs', () => {
  it('saves and recovers each run with its own conversation when runs start together', async () => {
    const original = await startProcess();

    // Real stores take a round trip on the existence read a nested run makes
    // before saving its pending snapshot; concurrent starts interleave there.
    const getRun = original.workflows.getWorkflowRunById.bind(original.workflows);
    original.workflows.getWorkflowRunById = async args => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return getRun(args);
    };

    // The store's contents at the moment each run's nested pending snapshot is
    // written: what a crash right then leaves behind.
    const rows = new Map<string, SnapshotRow>();
    const innerPending = new Map<string, SnapshotRow>();
    const atInnerPending = new Map<string, SnapshotRow[]>();
    const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
    original.workflows.persistWorkflowSnapshot = async args => {
      const copy = structuredClone(args) as SnapshotRow;
      rows.set(`${args.workflowName}:${args.runId}`, copy);
      if (
        args.workflowName === DurableStepIds.AGENTIC_EXECUTION &&
        args.snapshot.status === 'pending' &&
        !innerPending.has(args.runId)
      ) {
        innerPending.set(args.runId, copy);
        atInnerPending.set(
          args.runId,
          [...rows.values()].filter(row => row.runId === args.runId).map(row => structuredClone(row)),
        );
      }
      return persist(args);
    };

    const runIds = await Promise.all(
      LETTERS.map(async letter => {
        const result = await original.durableAgent.stream(`Look up ${secret(letter)}`, {
          memory: { thread: `thread-${letter}`, resource: `resource-${letter}` },
        });
        expect(await collectText(result)).toBe('done');
        return result.runId;
      }),
    );
    const runIdOf = (letter: Letter) => runIds[LETTERS.indexOf(letter)]!;

    expect(perRun(letter => secretsIn(innerPending.get(runIdOf(letter))?.snapshot))).toEqual(
      perRun(letter => [letter]),
    );

    for (const letter of LETTERS) {
      const recovering = await startProcess();
      for (const row of atInnerPending.get(runIdOf(letter))!) {
        await recovering.workflows.persistWorkflowSnapshot(row);
      }
      expect(await collectText(await recovering.durableAgent.recover(runIdOf(letter)))).toBe('done');
      expect(recovering.prompts.map(prompt => secretsIn(prompt))).toEqual([[letter], [letter]]);
      for (const other of LETTERS) {
        const saved = await recovering.memory.recall({ threadId: `thread-${other}`, resourceId: `resource-${other}` });
        expect(secretsIn(saved.messages)).toEqual(other === letter ? [letter] : []);
      }
    }
  }, 30_000);
});
