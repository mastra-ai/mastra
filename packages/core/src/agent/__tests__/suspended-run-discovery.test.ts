/**
 * Storage-backed suspended-run discovery.
 *
 * `getActiveThreadRunId()` is backed by an in-memory map, so it returns
 * `undefined` after a server restart or on a different instance. These tests
 * cover the durable path: `agent.listSuspendedRuns()` discovers suspended runs from
 * workflow snapshot storage, and `sendToolApproval()` falls back to it when
 * the in-memory map has no entry — making HITL approvals survive restarts.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const mockFindUser = vi.fn().mockImplementation(async (data: { name: string }) => {
  return { name: data.name, email: 'dero@mail.com' };
});

function createFindUserTool() {
  return createTool({
    id: 'Find user tool',
    description: 'Returns the name and email of a user',
    inputSchema: z.object({ name: z.string() }),
    requireApproval: true,
    execute: async input => {
      return mockFindUser(input);
    },
  });
}

function createMockModel({
  toolCallOnFirstCall = true,
  toolCallId = 'call-1',
  toolName = 'findUserTool',
}: { toolCallOnFirstCall?: boolean; toolCallId?: string; toolName?: string } = {}) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (toolCallOnFirstCall && callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId,
              toolName,
              input: '{"name":"Dero Israel"}',
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'User found' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

function createSuspendedSetup({
  storage = new InMemoryStore(),
  toolCallOnFirstCall = true,
  toolCallId,
}: { storage?: InMemoryStore; toolCallOnFirstCall?: boolean; toolCallId?: string } = {}) {
  const agent = new Agent({
    id: 'user-agent',
    name: 'User Agent',
    instructions: 'You find users.',
    model: createMockModel({ toolCallOnFirstCall, toolCallId }),
    tools: { findUserTool: createFindUserTool() },
  });

  const mastra = new Mastra({
    agents: { agent },
    logger: false,
    storage,
  });

  return { agent, mastra, storage };
}

async function suspendRun(agent: Agent, threadId: string, resourceId: string) {
  const stream = await agent.stream('Find the user with name - Dero Israel', {
    requireToolApproval: true,
    memory: { thread: threadId, resource: resourceId },
  });

  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
    }
  }
  expect(toolCallId).toBeTruthy();
  return { runId: stream.runId, toolCallId };
}

afterEach(() => {
  mockFindUser.mockClear();
});

// The loop workflows pick their engine from MASTRA_EVENTED_EXECUTION at
// creation time (per stream call), so discovery must work against rows
// persisted by both the default (direct) engine and the evented engine.
describe.each([
  { engine: 'default', evented: false },
  { engine: 'evented', evented: true },
])('suspended-run discovery ($engine engine)', ({ evented }) => {
  beforeAll(() => {
    if (evented) vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'true');
  });

  afterAll(() => {
    if (evented) vi.unstubAllEnvs();
  });

  describe('agent.listSuspendedRuns()', () => {
    it('returns suspended runs with thread, resource, and tool-call info', async () => {
      const { agent } = createSuspendedSetup();
      const { runId, toolCallId } = await suspendRun(agent, 'thread-1', 'resource-1');

      const { runs, total } = await agent.listSuspendedRuns();
      expect(total).toBe(1);
      expect(runs).toHaveLength(1);
      expect(runs[0]).toEqual({
        runId,
        status: 'suspended',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        suspendedAt: expect.any(Date),
        toolCalls: [
          {
            toolCallId,
            toolName: 'findUserTool',
            args: { name: 'Dero Israel' },
            requiresApproval: true,
          },
        ],
      });
    }, 30000);

    it('filters by threadId and resourceId', async () => {
      const { agent } = createSuspendedSetup();
      const { runId } = await suspendRun(agent, 'thread-1', 'resource-1');

      expect((await agent.listSuspendedRuns({ threadId: 'thread-1' })).runs).toHaveLength(1);
      expect((await agent.listSuspendedRuns({ threadId: 'other-thread' })).runs).toHaveLength(0);
      expect((await agent.listSuspendedRuns({ resourceId: 'resource-1' })).runs).toHaveLength(1);
      expect((await agent.listSuspendedRuns({ resourceId: 'other-resource' })).runs).toHaveLength(0);

      const scoped = await agent.listSuspendedRuns({ threadId: 'thread-1', resourceId: 'resource-1' });
      expect(scoped.runs.map(run => run.runId)).toEqual([runId]);
      expect(scoped.total).toBe(1);
    }, 30000);

    it('paginates with perPage/page while keeping total accurate', async () => {
      // The mock model only tool-calls on its first invocation, so suspend each
      // run from a fresh agent sharing the same storage.
      const storage = new InMemoryStore();
      await suspendRun(createSuspendedSetup({ storage }).agent, 'thread-1', 'resource-1');
      await suspendRun(createSuspendedSetup({ storage }).agent, 'thread-2', 'resource-1');
      const { agent } = createSuspendedSetup({ storage });
      await suspendRun(agent, 'thread-3', 'resource-1');

      const pageOne = await agent.listSuspendedRuns({ resourceId: 'resource-1', perPage: 2, page: 0 });
      expect(pageOne.total).toBe(3);
      expect(pageOne.runs).toHaveLength(2);

      const pageTwo = await agent.listSuspendedRuns({ resourceId: 'resource-1', perPage: 2, page: 1 });
      expect(pageTwo.total).toBe(3);
      expect(pageTwo.runs).toHaveLength(1);

      const pageOneIds = pageOne.runs.map(run => run.runId);
      const pageTwoIds = pageTwo.runs.map(run => run.runId);
      expect(new Set([...pageOneIds, ...pageTwoIds]).size).toBe(3);

      // Without both perPage and page, all matching runs are returned.
      expect((await agent.listSuspendedRuns({ resourceId: 'resource-1', perPage: 2 })).runs).toHaveLength(3);
    }, 30000);

    it('only returns runs owned by the listing agent', async () => {
      const storage = new InMemoryStore();
      const agentA = new Agent({
        id: 'agent-a',
        name: 'Agent A',
        instructions: 'You find users.',
        model: createMockModel(),
        tools: { findUserTool: createFindUserTool() },
      });
      const agentB = new Agent({
        id: 'agent-b',
        name: 'Agent B',
        instructions: 'You find users.',
        model: createMockModel(),
        tools: { findUserTool: createFindUserTool() },
      });
      new Mastra({ agents: { agentA, agentB }, logger: false, storage });

      // Both agents suspend for the same resource (distinct threads — a thread
      // only allows one active run at a time).
      const { runId: runA } = await suspendRun(agentA, 'thread-a', 'shared-resource');
      const { runId: runB } = await suspendRun(agentB, 'thread-b', 'shared-resource');

      const listedByA = await agentA.listSuspendedRuns({ resourceId: 'shared-resource' });
      expect(listedByA.runs.map(run => run.runId)).toEqual([runA]);
      expect(listedByA.total).toBe(1);

      const listedByB = await agentB.listSuspendedRuns({ resourceId: 'shared-resource' });
      expect(listedByB.runs.map(run => run.runId)).toEqual([runB]);
      expect(listedByB.total).toBe(1);
    }, 30000);

    it('rejects invalid pagination inputs', async () => {
      const { agent } = createSuspendedSetup();

      await expect(agent.listSuspendedRuns({ perPage: 0 })).rejects.toMatchObject({
        id: 'AGENT_LIST_SUSPENDED_RUNS_INVALID_PER_PAGE',
      });
      await expect(agent.listSuspendedRuns({ perPage: 1.5 })).rejects.toMatchObject({
        id: 'AGENT_LIST_SUSPENDED_RUNS_INVALID_PER_PAGE',
      });
      await expect(agent.listSuspendedRuns({ page: -1 })).rejects.toMatchObject({
        id: 'AGENT_LIST_SUSPENDED_RUNS_INVALID_PAGE',
      });
      await expect(agent.listSuspendedRuns({ page: 0.5 })).rejects.toMatchObject({
        id: 'AGENT_LIST_SUSPENDED_RUNS_INVALID_PAGE',
      });
    }, 30000);

    it('filters by fromDate and toDate', async () => {
      const { agent } = createSuspendedSetup();
      await suspendRun(agent, 'thread-1', 'resource-1');

      const past = new Date(Date.now() - 60_000);
      const future = new Date(Date.now() + 60_000);

      expect((await agent.listSuspendedRuns({ fromDate: past })).runs).toHaveLength(1);
      expect((await agent.listSuspendedRuns({ fromDate: future })).runs).toHaveLength(0);
      expect((await agent.listSuspendedRuns({ toDate: future })).runs).toHaveLength(1);
      expect((await agent.listSuspendedRuns({ toDate: past })).runs).toHaveLength(0);
    }, 30000);

    it('discovers suspend()-style suspensions with their suspend payload', async () => {
      const getUserTool = createTool({
        id: 'Get user tool',
        description: 'Returns a user, suspends to ask for the name',
        inputSchema: z.object({ name: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ name: z.string() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) {
            return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
          }
          return { name: context.agent.resumeData.name, email: 'dero@mail.com' };
        },
      });

      const agent = new Agent({
        id: 'suspending-agent',
        name: 'Suspending Agent',
        instructions: 'You find users.',
        model: createMockModel({ toolName: 'getUserTool' }),
        tools: { getUserTool },
      });
      new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });

      const stream = await agent.stream('Find the user', {
        memory: { thread: 'thread-1', resource: 'resource-1' },
      });
      for await (const _chunk of stream.fullStream) {
        // consume until the run suspends
      }

      const { runs } = await agent.listSuspendedRuns({ threadId: 'thread-1' });
      expect(runs).toHaveLength(1);
      expect(runs[0]!.runId).toBe(stream.runId);
      expect(runs[0]!.toolCalls).toEqual([
        expect.objectContaining({
          requiresApproval: false,
          suspendPayload: expect.objectContaining({ message: 'Please provide the name of the user' }),
        }),
      ]);
    }, 30000);

    it('returns an empty list once the run is resumed and completes', async () => {
      const { agent } = createSuspendedSetup();
      const { runId, toolCallId } = await suspendRun(agent, 'thread-1', 'resource-1');

      const resumeStream = await agent.approveToolCall({ runId, toolCallId });
      for await (const _chunk of resumeStream.fullStream) {
        // consume
      }

      expect((await agent.listSuspendedRuns()).runs).toHaveLength(0);
    }, 30000);

    it('scopes nested supervisor/subagent suspensions by threadId to the resumable outer run', async () => {
      const subAgent = new Agent({
        id: 'billing-agent',
        name: 'Billing Agent',
        instructions: 'You handle billing.',
        model: createMockModel(),
        tools: { findUserTool: createFindUserTool() },
      });
      const supervisorModel = new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'sup-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'sup-call-1',
              toolName: 'agent-billing-agent',
              input: '{"message":"Find Dero Israel"}',
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      });
      const supervisor = new Agent({
        id: 'support-agent',
        name: 'Support Agent',
        instructions: 'You delegate to billing.',
        model: supervisorModel,
        agents: { 'billing-agent': subAgent },
      });
      new Mastra({ agents: { supervisor, subAgent }, logger: false, storage: new InMemoryStore() });

      const stream = await supervisor.stream('Find the user Dero Israel via billing', {
        memory: { thread: 'thread-1', resource: 'resource-1' },
      });
      for await (const _chunk of stream.fullStream) {
        // consume until suspension
      }

      // Both the supervisor's outer run and the subagent's inner run persist
      // suspended agentic-loop rows, but snapshots carry the owning agent's id:
      // the supervisor only sees its own resumable outer run...
      const allRuns = await supervisor.listSuspendedRuns();
      expect(allRuns.runs.map(run => run.runId)).toEqual([stream.runId]);

      // ...while the subagent sees its inner run.
      const subAgentRuns = await subAgent.listSuspendedRuns();
      expect(subAgentRuns.runs).toHaveLength(1);
      expect(subAgentRuns.runs[0]!.runId).not.toBe(stream.runId);

      const scoped = await supervisor.listSuspendedRuns({ threadId: 'thread-1', resourceId: 'resource-1' });
      expect(scoped.runs.map(run => run.runId)).toEqual([stream.runId]);
      expect(scoped.runs[0]!.toolCalls).toEqual([
        {
          toolCallId: 'sup-call-1',
          toolName: 'agent-billing-agent',
          args: { message: 'Find Dero Israel' },
          requiresApproval: true,
        },
      ]);
    }, 30000);

    it('returns an empty list for a standalone agent (ephemeral in-memory storage)', async () => {
      // Mastra falls back to an in-memory store when no storage is configured
      // (and warns about it), so discovery never throws — it just finds nothing
      // durable. Suspended runs only survive restarts with persistent storage.
      const agent = new Agent({
        id: 'no-storage-agent',
        name: 'No Storage Agent',
        instructions: 'You find users.',
        model: createMockModel(),
        tools: { findUserTool: createFindUserTool() },
      });

      expect((await agent.listSuspendedRuns()).runs).toEqual([]);
    }, 30000);
  });

  describe('agent.sendToolApproval() storage fallback', () => {
    it('approves a suspended run after a simulated restart (in-memory state lost)', async () => {
      const storage = new InMemoryStore();
      const { agent } = createSuspendedSetup({ storage });
      const { runId, toolCallId } = await suspendRun(agent, 'thread-1', 'resource-1');

      // Simulate a server restart: a fresh Agent + Mastra process sharing the
      // same storage. The in-memory thread-run map is empty, but the suspended
      // snapshot is still in storage.
      const { agent: restartedAgent, mastra } = createSuspendedSetup({ storage, toolCallOnFirstCall: false });
      expect(restartedAgent.getActiveThreadRunId({ threadId: 'thread-1', resourceId: 'resource-1' })).toBeUndefined();

      const result = await restartedAgent.sendToolApproval({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        toolCallId,
        approved: true,
      });
      expect(result).toEqual({ accepted: true, runId, toolCallId });

      // The resumed run executes the approved tool and runs to completion,
      // leaving no suspended rows behind.
      const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
      await vi.waitFor(
        async () => {
          expect(mockFindUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dero Israel' }));
          expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
        },
        { timeout: 10000 },
      );
    }, 30000);

    it('declines a suspended run after a simulated restart', async () => {
      const storage = new InMemoryStore();
      const { agent } = createSuspendedSetup({ storage });
      const { runId } = await suspendRun(agent, 'thread-1', 'resource-1');

      const { agent: restartedAgent, mastra } = createSuspendedSetup({ storage, toolCallOnFirstCall: false });

      const result = await restartedAgent.sendToolApproval({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        approved: false,
      });
      expect(result.runId).toBe(runId);

      const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;
      await vi.waitFor(
        async () => {
          expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
        },
        { timeout: 10000 },
      );
      expect(mockFindUser).not.toHaveBeenCalled();
    }, 30000);

    it('throws on ambiguous suspended runs and disambiguates by toolCallId', async () => {
      const storage = new InMemoryStore();
      await suspendRun(createSuspendedSetup({ storage, toolCallId: 'call-a' }).agent, 'thread-1', 'resource-1');
      const second = await suspendRun(
        createSuspendedSetup({ storage, toolCallId: 'call-b' }).agent,
        'thread-1',
        'resource-1',
      );

      // Fresh process: two suspended runs match the thread and no toolCallId
      // is provided, so the fallback cannot pick one.
      const { agent: restartedAgent } = createSuspendedSetup({ storage, toolCallOnFirstCall: false });
      await expect(
        restartedAgent.sendToolApproval({
          threadId: 'thread-1',
          resourceId: 'resource-1',
          approved: true,
        }),
      ).rejects.toMatchObject({
        id: 'AGENT_SEND_TOOL_APPROVAL_AMBIGUOUS_SUSPENDED_RUNS',
      });

      // Passing the toolCallId narrows the match to a single run.
      const result = await restartedAgent.sendToolApproval({
        threadId: 'thread-1',
        resourceId: 'resource-1',
        toolCallId: second.toolCallId,
        approved: true,
      });
      expect(result).toEqual({ accepted: true, runId: second.runId, toolCallId: second.toolCallId });
    }, 30000);

    it('throws when no active or suspended run exists for the thread', async () => {
      const { agent } = createSuspendedSetup();

      await expect(
        agent.sendToolApproval({
          threadId: 'thread-without-run',
          resourceId: 'resource-1',
          approved: true,
        }),
      ).rejects.toMatchObject({
        id: 'AGENT_SEND_TOOL_APPROVAL_NO_ACTIVE_THREAD_RUN',
      });
    }, 30000);

    it('surfaces storage failures instead of reporting "no suspended run"', async () => {
      const storage = new InMemoryStore();
      const { agent } = createSuspendedSetup({ storage });

      const workflowsStore = (await storage.getStore('workflows'))!;
      vi.spyOn(workflowsStore, 'listWorkflowRuns').mockRejectedValue(new Error('storage outage'));

      await expect(
        agent.sendToolApproval({
          threadId: 'thread-1',
          resourceId: 'resource-1',
          approved: true,
        }),
      ).rejects.toThrow('storage outage');
    }, 30000);
  });
});
