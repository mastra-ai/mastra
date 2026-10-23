/**
 * Snapshot-persistence policy for durable agents (issue #23915).
 *
 * `running` checkpoints exist solely to feed crash recovery
 * (`listActiveRuns()` / `recover()` / `recoverActiveRuns()`), yet they used to
 * be written unconditionally — pure write amplification for anyone with
 * `recovery.durableAgents` left at its `'off'` default. The default policy is
 * now derived from the recovery config: `pending | paused | suspended` are
 * always persisted (HITL resume depends on them), and `running` only when
 * `recovery.durableAgents: 'auto'`. A user-supplied `shouldPersistSnapshot`
 * predicate overrides the default entirely, with guardrail warnings for the
 * two footguns (dropping `suspended`/`paused`, or dropping `running` while
 * auto-recovery is on). EventedAgent owns its policy and warns-and-ignores
 * the option.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { ShouldPersistSnapshotFn, WorkflowRunStatus } from '../../../workflows/types';
import { Agent } from '../../agent';
import type { ToolsInput } from '../../types';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

function fakeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
  } as any;
}

/**
 * Mock model that drives `toolIterations` sequential tool calls before
 * finishing with text — each iteration is one persisted step in the durable
 * loop.
 */
function createLoopingModel(toolIterations: number, toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount += 1;
      const stream =
        callCount <= toolIterations
          ? convertArrayToReadableStream<any>([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: `call-${callCount}`,
                toolName,
                input: JSON.stringify({ index: callCount }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ])
          : convertArrayToReadableStream<any>([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]);
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
}

interface PersistRecord {
  workflowName: string;
  status: string | undefined;
}

interface Harness {
  durableAgent: any;
  logger: ReturnType<typeof fakeLogger>;
  recorded: PersistRecord[];
  /**
   * Wait until terminal cleanup deletes the run's snapshot rows. The delete
   * only fires after `run.start()` resolves (durable-agent.ts
   * `executeWorkflow`), i.e. after every engine persist for the run, so it is
   * a deterministic "no more writes are coming" barrier.
   */
  waitForRunCleanup: (runId: string) => Promise<void>;
}

/**
 * Registers a durable agent on a Mastra instance backed by an
 * {@link InMemoryStore} and records every `persistWorkflowSnapshot` call the
 * storage layer receives.
 */
async function setup(options: {
  agentId: string;
  model: MockLanguageModelV2;
  tools: ToolsInput;
  recovery?: 'auto' | 'off';
  shouldPersistSnapshot?: ShouldPersistSnapshotFn;
}): Promise<Harness> {
  const baseAgent = new Agent({
    id: options.agentId,
    name: options.agentId,
    instructions: 'Use your tools.',
    model: options.model as LanguageModelV2,
    tools: options.tools,
  });
  const durableAgent = createDurableAgent({
    agent: baseAgent,
    shouldPersistSnapshot: options.shouldPersistSnapshot,
  });
  const logger = fakeLogger();
  const mastra = new Mastra({
    agents: { [options.agentId]: durableAgent as any },
    storage: new InMemoryStore(),
    logger,
    ...(options.recovery ? { recovery: { durableAgents: options.recovery } } : {}),
  });

  const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))! as any;
  const recorded: PersistRecord[] = [];
  const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
  workflowsStore.persistWorkflowSnapshot = async (args: any) => {
    recorded.push({ workflowName: args.workflowName, status: args.snapshot?.status });
    return originalPersist(args);
  };

  const deletedRunIds = new Set<string>();
  const originalDelete = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
  workflowsStore.deleteWorkflowRunById = async (args: any) => {
    deletedRunIds.add(args.runId);
    return originalDelete(args);
  };

  const waitForRunCleanup = async (runId: string) => {
    await vi.waitFor(() => expect(deletedRunIds.has(runId)).toBe(true), { timeout: 30000 });
  };

  return { durableAgent, logger, recorded, waitForRunCleanup };
}

async function drain(stream: AsyncIterable<any>): Promise<string[]> {
  const chunkTypes: string[] = [];
  for await (const chunk of stream) {
    chunkTypes.push(chunk.type);
  }
  return chunkTypes;
}

const runningWrites = (recorded: PersistRecord[]) => recorded.filter(r => r.status === 'running');

/** Every member of {@link WorkflowRunStatus}, for exhaustive policy probes. */
const ALL_STATUSES: readonly WorkflowRunStatus[] = [
  'running',
  'success',
  'failed',
  'tripwire',
  'suspended',
  'waiting',
  'pending',
  'canceled',
  'bailed',
  'paused',
  'skipped',
];

/** The statuses a policy persists, probed with empty step results. */
const persistedStatuses = (policy: ShouldPersistSnapshotFn): WorkflowRunStatus[] =>
  ALL_STATUSES.filter(workflowStatus => policy({ workflowStatus, stepResults: {} })).sort();

describe('durable agent snapshot-persistence policy (issue #23915)', () => {
  describe('default policy with recovery off', () => {
    it('does not persist running checkpoints and the run completes normally', async () => {
      const toolExecute = vi.fn().mockResolvedValue({ ok: true });
      const echoTool = {
        id: 'echoTool',
        description: 'Echoes',
        inputSchema: z.object({ index: z.number() }),
        execute: toolExecute,
      };
      const { durableAgent, recorded, waitForRunCleanup } = await setup({
        agentId: 'default-off-agent',
        model: createLoopingModel(2, 'echoTool'),
        tools: { echoTool },
      });

      const result: any = await durableAgent.stream('Call the tool twice');
      const chunkTypes = await drain(result.fullStream);
      await waitForRunCleanup(result.runId);

      // The loop actually ran: both tool iterations executed and the stream
      // finished without an error chunk.
      expect(toolExecute).toHaveBeenCalledTimes(2);
      expect(chunkTypes).not.toContain('error');
      // The point of the change: zero `running` writes reached storage.
      expect(runningWrites(recorded)).toHaveLength(0);
      // The predicate was actually consulted — other statuses still persist,
      // and every write that landed is one of the always-persisted resume
      // statuses (no terminal or bookkeeping statuses slip through either).
      expect(recorded.length).toBeGreaterThan(0);
      for (const { status } of recorded) {
        expect(['pending', 'paused', 'suspended']).toContain(status);
      }
    }, 60000);

    it('resolves the exact status matrix: pending|paused|suspended always, running only when recovery is auto', async () => {
      const noTools = {};
      const off = await setup({
        agentId: 'matrix-off-agent',
        model: createLoopingModel(0, 'unused'),
        tools: noTools,
      });
      const auto = await setup({
        agentId: 'matrix-auto-agent',
        model: createLoopingModel(0, 'unused'),
        tools: noTools,
        recovery: 'auto',
      });

      const offPolicy = (off.durableAgent as any).resolveShouldPersistSnapshot() as ShouldPersistSnapshotFn;
      const autoPolicy = (auto.durableAgent as any).resolveShouldPersistSnapshot() as ShouldPersistSnapshotFn;

      expect(persistedStatuses(offPolicy)).toEqual(['paused', 'pending', 'suspended']);
      expect(persistedStatuses(autoPolicy)).toEqual(['paused', 'pending', 'running', 'suspended']);
    });

    it('leaves listActiveRuns() empty while a run is in flight', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      let toolStarted = false;
      const blockingTool = {
        id: 'blockingTool',
        description: 'Blocks until released',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => {
          toolStarted = true;
          await gate;
          return { ok: true };
        },
      };
      const { durableAgent, recorded, waitForRunCleanup } = await setup({
        agentId: 'inflight-off-agent',
        model: createLoopingModel(1, 'blockingTool'),
        tools: { blockingTool },
      });

      const result: any = await durableAgent.stream('Call the tool');
      const drained = drain(result.fullStream);
      await vi.waitFor(() => expect(toolStarted).toBe(true), { timeout: 30000 });

      // Mid-run, with the tool blocked: no running snapshot exists, so the
      // discovery API sees nothing.
      const active = await (durableAgent as any).listActiveRuns();
      expect(active.total).toBe(0);
      expect(runningWrites(recorded)).toHaveLength(0);

      release();
      await drained;
      await waitForRunCleanup(result.runId);
      expect(runningWrites(recorded)).toHaveLength(0);
    }, 60000);
  });

  describe('HITL under the default policy', () => {
    it('persists the suspended snapshot, resumes via approval, and does not warn about unclaimed resumes', async () => {
      let modelCall = 0;
      const model = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>(
            ++modelCall === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'searchTool',
                    input: '{"query":"test"}',
                    providerExecuted: false,
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Finished' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                  },
                ],
          ),
        }),
      });
      const searchTool = {
        id: 'searchTool',
        description: 'Search',
        inputSchema: z.object({ query: z.string() }),
        requireApproval: true,
        execute: async () => ({ results: ['result1'] }),
      };
      const { durableAgent, logger, recorded } = await setup({
        agentId: 'hitl-agent',
        model,
        tools: { searchTool },
      });

      const result: any = await durableAgent.stream('Search for test');
      let sawApproval = false;
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call-approval') {
          sawApproval = true;
          break;
        }
      }
      expect(sawApproval).toBe(true);

      // The suspend record — the artifact HITL resume depends on — reached
      // storage even though `running` writes are off.
      await vi.waitFor(() => {
        expect(recorded.some(r => r.status === 'suspended')).toBe(true);
      });
      expect(runningWrites(recorded)).toHaveLength(0);

      const resumed: any = await (durableAgent as any).approveToolCall({ runId: result.runId });
      const resumedTypes = await drain(resumed.fullStream);
      expect(resumedTypes).not.toContain('error');
      expect(modelCall).toBe(2);

      // `allowUnclaimedResumes` is set on the durable workflows, so the
      // unclaimable resume (no `running` claim row) must not warn.
      const warnings = logger.warn.mock.calls.map((c: any[]) => String(c[0]));
      expect(warnings.filter((m: string) => m.includes('cannot be de-duplicated'))).toHaveLength(0);
    }, 60000);
  });

  describe('recovery.durableAgents: auto', () => {
    it('persists running checkpoints and listActiveRuns() discovers the in-flight run', async () => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      const blockingTool = {
        id: 'blockingTool',
        description: 'Blocks until released',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => {
          await gate;
          return { ok: true };
        },
      };
      const { durableAgent, recorded, waitForRunCleanup } = await setup({
        agentId: 'inflight-auto-agent',
        model: createLoopingModel(1, 'blockingTool'),
        tools: { blockingTool },
        recovery: 'auto',
      });

      const result: any = await durableAgent.stream('Call the tool');
      const drained = drain(result.fullStream);

      // Mid-run the running snapshot is on disk and discoverable.
      await vi.waitFor(
        async () => {
          const active = await (durableAgent as any).listActiveRuns();
          expect(active.total).toBeGreaterThanOrEqual(1);
          expect(active.runs.map((r: any) => r.runId)).toContain(result.runId);
        },
        { timeout: 30000 },
      );

      release();
      await drained;
      await waitForRunCleanup(result.runId);
      expect(runningWrites(recorded).length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('explicit shouldPersistSnapshot', () => {
    it('including running with recovery off persists running checkpoints (manual-recovery escape hatch)', async () => {
      const echoTool = {
        id: 'echoTool',
        description: 'Echoes',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => ({ ok: true }),
      };
      const { durableAgent, logger, recorded, waitForRunCleanup } = await setup({
        agentId: 'manual-recovery-agent',
        model: createLoopingModel(2, 'echoTool'),
        tools: { echoTool },
        shouldPersistSnapshot: ({ workflowStatus }) =>
          workflowStatus === 'pending' ||
          workflowStatus === 'paused' ||
          workflowStatus === 'suspended' ||
          workflowStatus === 'running',
      });

      const result: any = await durableAgent.stream('Call the tool twice');
      await drain(result.fullStream);
      await waitForRunCleanup(result.runId);

      expect(runningWrites(recorded).length).toBeGreaterThan(0);
      // A predicate covering the full set trips no guardrail.
      expect(logger.warn.mock.calls.map((c: any[]) => String(c[0]))).not.toContainEqual(
        expect.stringContaining('shouldPersistSnapshot'),
      );
    }, 60000);

    it('excluding running while recovery is auto warns and skips running writes', async () => {
      const echoTool = {
        id: 'echoTool',
        description: 'Echoes',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => ({ ok: true }),
      };
      const { durableAgent, logger, recorded, waitForRunCleanup } = await setup({
        agentId: 'invisible-agent',
        model: createLoopingModel(1, 'echoTool'),
        tools: { echoTool },
        recovery: 'auto',
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' && workflowStatus !== 'failed',
      });

      const result: any = await durableAgent.stream('Call the tool');
      await drain(result.fullStream);
      await waitForRunCleanup(result.runId);

      expect(runningWrites(recorded)).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("does not persist 'running'"));
    }, 60000);

    it('excluding suspended warns that HITL resume is broken', async () => {
      const echoTool = {
        id: 'echoTool',
        description: 'Echoes',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => ({ ok: true }),
      };
      const { durableAgent, logger } = await setup({
        agentId: 'hitl-footgun-agent',
        model: createLoopingModel(1, 'echoTool'),
        tools: { echoTool },
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'running',
      });

      // The guardrail probes run once, on first workflow creation.
      (durableAgent as any).getWorkflow();

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("does not persist 'suspended'"));
    });
  });

  describe('EventedAgent', () => {
    it('warns and ignores a user-supplied shouldPersistSnapshot, keeping the full set pinned', async () => {
      const baseAgent = new Agent({
        id: 'evented-pinned-agent',
        name: 'evented-pinned-agent',
        instructions: 'x',
        model: createLoopingModel(1, 'echoTool') as LanguageModelV2,
      });
      const userPredicate: ShouldPersistSnapshotFn = ({ workflowStatus }) => workflowStatus === 'suspended';
      const eventedAgent = createEventedAgent({ agent: baseAgent, shouldPersistSnapshot: userPredicate });
      const logger = fakeLogger();
      new Mastra({
        agents: { 'evented-pinned-agent': eventedAgent as any },
        storage: new InMemoryStore(),
        logger,
      });

      (eventedAgent as any).getWorkflow();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ignoring the shouldPersistSnapshot option'));

      // The pinned policy persists exactly the full active set — the user
      // predicate (which only allowed `suspended`) had no effect, and no
      // terminal status is persisted either.
      const pinned = (eventedAgent as any).resolveShouldPersistSnapshot() as ShouldPersistSnapshotFn;
      expect(persistedStatuses(pinned)).toEqual(['paused', 'pending', 'running', 'suspended']);
      expect(userPredicate({ workflowStatus: 'running', stepResults: {} })).toBe(false);
    });
  });
});
