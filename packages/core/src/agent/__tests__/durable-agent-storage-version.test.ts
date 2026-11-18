/**
 * The workflow storage version durable agents store their new runs in.
 *
 * Kept outside `src/agent/durable/` so the `durable-other-storage-version`
 * Vitest project, which flips the default, doesn't run it: these tests pin the
 * default users get.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { DurableStepIds } from '../durable/constants';
import { createDurableAgent } from '../durable/create-durable-agent';
import { createEventedAgent } from '../durable/create-evented-agent';
import { globalRunRegistry } from '../durable/run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** Calls the approval-gated tool, so the run suspends and stays stored. */
function createModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName: 'approvalTool',
          input: '{}',
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage },
      ] as any),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function fakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any;
}

type AgentKind = 'durable' | 'evented';

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  globalRunRegistry.clear();
});

/**
 * Registers an agent and suspends one run at a tool approval. Returns the
 * stored run's storage version and the warnings logged.
 */
async function storeOneRun(
  kind: AgentKind,
  { storageVersion, journal = true }: { storageVersion?: 1 | 2; journal?: boolean } = {},
) {
  const storage = new InMemoryStore();
  if (!journal) vi.spyOn(storage.stores!.workflows!, 'supportsRunJournal').mockReturnValue(false);
  const pubsub = new EventEmitterPubSub();
  const agent = new Agent({
    id: 'version-agent',
    name: 'Version Agent',
    instructions: 'Use the tool.',
    model: createModel() as LanguageModelV2,
    tools: {
      approvalTool: createTool({
        id: 'approvalTool',
        description: 'approval-gated tool',
        inputSchema: z.object({}),
        requireApproval: true,
        execute: async () => 'approved',
      }),
    },
  });
  const durableAgent =
    kind === 'evented'
      ? createEventedAgent({ agent, pubsub, storageVersion })
      : createDurableAgent({ agent, pubsub, storageVersion });
  const logger = fakeLogger();
  const mastra = new Mastra({ logger, storage, pubsub, agents: { versionAgent: durableAgent } });
  cleanups.push(
    () => mastra.shutdown(),
    () => pubsub.close(),
  );

  const onSuspended = vi.fn();
  const stream = await durableAgent.stream('Go', { onSuspended });
  cleanups.push(() => stream.cleanup());
  await vi.waitFor(() => expect(onSuspended).toHaveBeenCalled());

  const workflows = (await storage.getStore('workflows'))!;
  const { runs } = await workflows.listWorkflowRuns({ workflowName: DurableStepIds.AGENTIC_LOOP });
  expect(runs).toHaveLength(1);
  const warnings: string[] = logger.warn.mock.calls.map((call: unknown[]) => String(call[0]));
  return { storedVersion: runs[0]!.storageVersion ?? 1, warnings };
}

describe.each(['durable', 'evented'] as const)('%s agent storage version', kind => {
  it('stores new runs as version 1 by default', async () => {
    const { storedVersion, warnings } = await storeOneRun(kind);
    expect(storedVersion).toBe(1);
    expect(warnings.filter(w => w.includes('storageVersion'))).toEqual([]);
  });

  it.each([1, 2] as const)('stores new runs as version %i when storageVersion asks for it', async storageVersion => {
    const { storedVersion } = await storeOneRun(kind, { storageVersion });
    expect(storedVersion).toBe(storageVersion);
  });

  it('stores new runs as version 1 with a warning when the store has no version 2 support', async () => {
    const { storedVersion, warnings } = await storeOneRun(kind, { storageVersion: 2, journal: false });
    expect(storedVersion).toBe(1);
    expect(warnings.filter(w => w.includes('storageVersion: 2'))).toEqual([
      expect.stringMatching(/'version-agent' sets storageVersion: 2, .*storing new runs as version 1/),
    ]);
  });
});
