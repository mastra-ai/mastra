/**
 * Per-entry model settings after a restart (#27550).
 *
 * On recovery the live model list only rebinds model instances; per-entry
 * `modelSettings` come back from the persisted workflow input
 * (`modelList[].config.settings`). This runs a tool round-trip, copies the
 * workflow store after every write, then recovers each checkpoint taken
 * between the two model calls in a fresh module graph (standing in for a new
 * process) and checks the request the recovered run sends.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import { DurableStepIds } from '../constants';

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };
type Checkpoint = { rows: SnapshotRow[]; requestsSoFar: number };
type JournalEntry = { body: Record<string, unknown> };
// `evented-fallback` is an EventedAgent on a store without atomic concurrent
// updates, the same setup durable-agent-crash-recovery.test.ts recovers.
type AgentKind = 'durable' | 'evented-fallback';

const RECOVERY_TIMEOUT_MS = 5_000;

let llm: LLMock;

beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});

afterAll(async () => {
  await llm.stop();
});

beforeEach(() => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
  llm.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: {} }] },
  );
  llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'done' });
});

async function startProcess(kind: AgentKind) {
  vi.resetModules();
  const [{ Mastra }, { InMemoryStore }, { Agent }, { createDurableAgent }, { createEventedAgent }] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../create-evented-agent'),
  ]);
  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` });
  const agent = new Agent({
    id: 'settings-agent',
    name: 'settings-agent',
    instructions: 'Use your tools.',
    // Real OpenAI id: Mastra strips temperature/topP for ids its capability
    // registry does not list as temperature-capable.
    model: [
      {
        id: 'gpt-4o-mini',
        model: openai.chat('gpt-4o-mini'),
        maxRetries: 0,
        modelSettings: { temperature: 0.1, topP: 0.5 },
      },
    ],
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({}),
        execute: async () => ({ ok: true }),
      },
    },
  });
  const durableAgent = kind === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage = new InMemoryStore();
  // Before `new Mastra(...)`: the engine resolves during agent registration.
  if (kind === 'evented-fallback') {
    vi.spyOn(storage.stores.workflows!, 'supportsConcurrentUpdates').mockReturnValue(false);
  }
  const mastra = new Mastra({
    agents: { settingsAgent: durableAgent },
    storage,
    logger: false,
    recovery: { durableAgents: 'auto' },
  });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows };
}

async function drain(stream: { fullStream: AsyncIterable<any> }) {
  for await (const _chunk of stream.fullStream) {
    // consume
  }
}

describe.each<AgentKind>(['durable', 'evented-fallback'])('%s recovery: per-entry model settings', kind => {
  it('sends the entry modelSettings on the model call made after recover()', async () => {
    const original = await startProcess(kind);
    const rows = new Map<string, SnapshotRow>();
    const checkpoints: Checkpoint[] = [];
    const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
    original.workflows.persistWorkflowSnapshot = async args => {
      rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
      checkpoints.push({
        rows: [...rows.values()].map(row => structuredClone(row)),
        requestsSoFar: llm.getRequests().length,
      });
      return persist(args);
    };

    const result = await original.durableAgent.stream('Look it up');
    await drain(result);
    const firstRun = llm.getRequests() as JournalEntry[];
    expect(firstRun).toHaveLength(2);
    for (const request of firstRun) expect(request.body).toMatchObject({ temperature: 0.1, top_p: 0.5 });

    // Taken after the tool call came back and before the final model call.
    const midRun = checkpoints.filter(
      ({ rows, requestsSoFar }) =>
        requestsSoFar === 1 &&
        rows.some(row => row.workflowName === DurableStepIds.AGENTIC_LOOP && row.snapshot.status === 'running') &&
        rows.some(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP),
    );
    expect(midRun.length).toBeGreaterThan(0);

    let recoveredCalls = 0;
    for (const checkpoint of midRun) {
      llm.clearRequests();
      const restarted = await startProcess(kind);
      for (const row of checkpoint.rows) await restarted.workflows.persistWorkflowSnapshot(row);
      const attempt = restarted.durableAgent.recover(result.runId).then(drain);
      await Promise.race([attempt.catch(() => {}), new Promise(resolve => setTimeout(resolve, RECOVERY_TIMEOUT_MS))]);

      for (const request of llm.getRequests() as JournalEntry[]) {
        recoveredCalls++;
        expect(request.body).toMatchObject({ model: 'gpt-4o-mini', temperature: 0.1, top_p: 0.5 });
      }
    }
    expect(recoveredCalls).toBeGreaterThan(0);
  }, 120_000);
});
