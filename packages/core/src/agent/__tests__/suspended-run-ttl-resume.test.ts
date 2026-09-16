/**
 * What the suspended-run TTL means for callers, end to end.
 *
 * A suspended `agent.stream()` run is kept warm so a resume that lands on the same
 * instance reattaches to in-memory state instead of rehydrating a snapshot. That warm
 * state is now bounded by `MASTRA_SUSPENDED_RUN_TTL_MS`: within the window nothing
 * changes, and once it lapses the record is evicted and resume falls back to the
 * durable snapshot — the same path a restart or a resume on another instance takes.
 *
 * The runtime and `Mastra`'s run-scoped internal-workflow registry both read that one
 * knob, so a lapsed TTL drops *both* halves of a suspended run's in-memory state. The
 * post-TTL resume test below therefore also covers resuming with neither half warm.
 *
 * Virtual time is advanced around the sweeping turn exactly as `runscope-leak.test.ts`
 * does for the same TTL, then real timers are restored for the resume itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

// The thread-stream runtime and this registry both read `MASTRA_SUSPENDED_RUN_TTL_MS`
// (asserted in `mastra/internal-workflow-registry.test.ts`), so a single advance past
// this bound expires both halves of a suspended run's warm state.
const SUSPENDED_RUN_TTL_MS = Mastra.INTERNAL_WORKFLOW_TTL_MS;
// How far into the window the warm-resume test parks. Derived from the TTL rather than
// a fixed margin: this file takes whatever `MASTRA_SUSPENDED_RUN_TTL_MS` the environment
// configured, and a fixed subtraction would go negative — winding the clock backwards
// instead of into the window — for any TTL at or below that margin.
const WITHIN_TTL_MS = Math.floor(SUSPENDED_RUN_TTL_MS / 2);

const RESOURCE_ID = 'resource-1';
const SUSPENDED_THREAD_ID = 'thread-suspended';
const SWEEP_THREAD_ID = 'thread-sweep';

const findUser = vi.fn(async (input: { name: string }) => ({ name: input.name, email: 'dero@mail.com' }));

function createToolCallThenTextModel() {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'findUserTool',
              input: '{"name":"Dero Israel"}',
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
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
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

function createTextOnlyModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sweep-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function createSetup() {
  const agent = new Agent({
    id: 'user-agent',
    name: 'User Agent',
    instructions: 'You find users.',
    model: createToolCallThenTextModel(),
    tools: {
      findUserTool: createTool({
        id: 'Find user tool',
        description: 'Returns the name and email of a user',
        inputSchema: z.object({ name: z.string() }),
        requireApproval: true,
        execute: async input => findUser(input),
      }),
    },
  });
  // A second agent on its own thread is all it takes to trigger the sweep — the
  // registry is per-process, not per-thread, and registration is what sweeps.
  const sweeperAgent = new Agent({
    id: 'sweeper-agent',
    name: 'Sweeper Agent',
    instructions: 'You answer briefly.',
    model: createTextOnlyModel(),
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { agent, sweeperAgent }, logger: false, storage });
  return { agent, sweeperAgent, mastra, storage };
}

async function suspendRun(agent: Agent) {
  const stream = await agent.stream('Find the user with name - Dero Israel', {
    requireToolApproval: true,
    memory: { thread: SUSPENDED_THREAD_ID, resource: RESOURCE_ID },
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

/**
 * Age parked state by `elapsedMs`, then take a turn on an unrelated thread: registering
 * a run is what triggers the sweep. Real timers come back before the caller resumes, so
 * the resume runs unfaked.
 */
async function sweepAfter(elapsedMs: number, sweeperAgent: Agent) {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.now() });
  vi.setSystemTime(Date.now() + elapsedMs);
  try {
    const stream = await sweeperAgent.stream('hello', {
      memory: { thread: SWEEP_THREAD_ID, resource: RESOURCE_ID },
    });
    for await (const _chunk of stream.fullStream) {
      // drain so this turn reaches a terminal state of its own
    }
  } finally {
    vi.useRealTimers();
  }
}

describe('suspended agent runs are released from memory after a TTL', () => {
  afterEach(() => {
    vi.useRealTimers();
    findUser.mockClear();
  });

  it('reattaches to warm in-memory state when the resume lands inside the TTL', async () => {
    const { agent, sweeperAgent } = createSetup();
    const { runId, toolCallId } = await suspendRun(agent);

    expect(agent.getActiveThreadRunId({ threadId: SUSPENDED_THREAD_ID, resourceId: RESOURCE_ID })).toBe(runId);

    await sweepAfter(WITHIN_TTL_MS, sweeperAgent);

    // Still warm: the thread is still blocked by the suspended run, and
    // `sendStreamResume()` — which resolves the run from in-memory state only —
    // still finds it.
    expect(agent.getActiveThreadRunId({ threadId: SUSPENDED_THREAD_ID, resourceId: RESOURCE_ID })).toBe(runId);

    const resumed = await agent.sendStreamResume({
      threadId: SUSPENDED_THREAD_ID,
      resourceId: RESOURCE_ID,
      runId,
      toolCallId,
      resumeData: { approved: true },
    });
    expect(resumed).toEqual({ accepted: true, runId, toolCallId });

    await vi.waitFor(
      async () => {
        expect(findUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dero Israel' }));
        expect((await agent.listSuspendedRuns({ threadId: SUSPENDED_THREAD_ID })).runs).toHaveLength(0);
      },
      { timeout: 10_000 },
    );
  }, 30000);

  it('drops warm state past the TTL and resumes the run from its durable snapshot', async () => {
    const { agent, sweeperAgent, storage } = createSetup();
    const { runId, toolCallId } = await suspendRun(agent);

    await sweepAfter(SUSPENDED_RUN_TTL_MS + 1, sweeperAgent);

    // The transcript is gone and the thread is unblocked: a follow-up turn no
    // longer waits behind a suspend nobody is coming back for.
    expect(agent.getActiveThreadRunId({ threadId: SUSPENDED_THREAD_ID, resourceId: RESOURCE_ID })).toBeUndefined();
    // The run itself is untouched: dropping warm state only releases memory, so
    // the run is still durably suspended and discoverable.
    const { runs } = await agent.listSuspendedRuns({ threadId: SUSPENDED_THREAD_ID });
    expect(runs.map(run => run.runId)).toEqual([runId]);

    // Resume recovers the run from its snapshot rather than requiring warm
    // state, which is what also lets a resume land on a restarted process or a
    // different server instance than the one that suspended the run.
    const resumed = await agent.sendStreamResume({
      threadId: SUSPENDED_THREAD_ID,
      resourceId: RESOURCE_ID,
      runId,
      toolCallId,
      resumeData: { approved: true },
    });
    expect(resumed).toEqual({ accepted: true, runId, toolCallId });

    const workflowsStore = (await storage.getStore('workflows'))!;
    await vi.waitFor(
      async () => {
        expect(findUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Dero Israel' }));
        expect((await workflowsStore.listWorkflowRuns({})).runs).toHaveLength(0);
      },
      { timeout: 10_000 },
    );
  }, 30000);
});
