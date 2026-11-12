/**
 * A run parks on a tool suspension (a plan or access prompt waiting on the
 * user), then the process that ran it goes away. The run stays in storage as
 * suspended and the thread still shows the call waiting. A session opened on a
 * fresh controller must be able to answer that call: claiming it has to find
 * the stored run, and the answer has to resume it. Before the fix the claim only
 * looked at in-memory suspensions, so it returned `no_pending_suspension` and
 * the prompt stayed on the page with buttons that do nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function modelStream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

async function setup() {
  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const resumed: unknown[] = [];
  const requestAccess = createTool({
    id: 'request-access',
    description: 'Ask the user for access to a path.',
    inputSchema: z.object({ path: z.string() }),
    execute: async (_input: { path: string }, context?: any) => {
      const resumeData = context?.agent?.resumeData ?? context?.resumeData;
      if (resumeData !== undefined) {
        resumed.push(resumeData);
        return `access: ${resumeData}`;
      }
      await (context?.agent?.suspend ?? context?.suspend)({ kind: 'access_request' });
      return 'unreachable';
    },
  });
  // Shared across controllers so a resumed run continues the conversation.
  const model = new MastraLanguageModelV2Mock({
    doStream: async ({ prompt }) => {
      const answered = JSON.stringify(prompt).includes('"type":"tool-result"');
      return {
        stream: answered
          ? modelStream([
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ])
          : modelStream([
              { type: 'tool-call', toolCallId: 'call-1', toolName: 'requestAccess', input: '{"path":"/x"}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]),
      };
    },
  });

  async function makeController(id: string) {
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'agent',
      name: 'agent',
      instructions: 'You help.',
      memory,
      model,
      tools: { requestAccess },
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage, pubsub });
    const registered = mastra.getAgent('agent');
    const controller = new AgentController({
      agent: registered,
      pubsub,
      workspace: createMockWorkspace(),
      id,
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registered }],
      initialState: { yolo: true } as any,
    });
    await controller.init();
    return controller;
  }

  return { makeController, resumed };
}

describe('a suspension stored by a process that is gone', () => {
  it('can be claimed and answered from a session on a fresh controller', async () => {
    const { makeController, resumed } = await setup();

    const first = await makeController('code');
    const parked = await first.createSession({ id: 'session-1', ownerId: 'owner-1' });
    await parked.thread.create();
    const threadId = parked.thread.getId()!;
    await parked.sendMessage({ content: 'Read /x' });
    expect(parked.displayState.get().pendingSuspensions.size).toBe(1);

    // The process that ran the turn is gone; only storage remains.
    const second = await makeController('code');
    const reopened = await second.createSession({ id: 'session-1', ownerId: 'owner-1', threadId } as never);
    expect(reopened.thread.getId()).toBe(threadId);

    const { runs } = await reopened.machinery.getAgent().listSuspendedRuns({
      threadId,
      resourceId: reopened.identity.getResourceId(),
    });
    expect(runs.flatMap(run => run.toolCalls.map(call => call.toolCallId))).toContain('call-1');

    // What the tool-suspension route does before claiming.
    await reopened.restoreStoredToolSuspension('call-1');
    const claim = reopened.claimToolSuspension('call-1');
    expect(claim).toMatchObject({ accepted: true, toolCallId: 'call-1' });
    if (!claim.accepted) return;

    await reopened.respondToToolSuspension({ resumeData: 'Yes', address: claim.address });
    await vi.waitFor(() => expect(resumed).toEqual(['Yes']));
  });

  it('still refuses a call that nothing in storage is waiting on', async () => {
    const { makeController } = await setup();
    const first = await makeController('code');
    const parked = await first.createSession({ id: 'session-1', ownerId: 'owner-1' });
    await parked.thread.create();
    const threadId = parked.thread.getId()!;
    await parked.sendMessage({ content: 'Read /x' });

    const second = await makeController('code');
    const reopened = await second.createSession({ id: 'session-1', ownerId: 'owner-1', threadId } as never);
    await reopened.restoreStoredToolSuspension('call-unknown');
    expect(reopened.claimToolSuspension('call-unknown')).toEqual({ accepted: false, reason: 'no_pending_suspension' });
    await reopened.restoreStoredToolSuspension('call-1', 'other-run');
    expect(reopened.claimToolSuspension('call-1', 'other-run')).toMatchObject({ accepted: false });
  });

  it('reads at most ten pages of stored runs for an id it cannot find', async () => {
    const { makeController } = await setup();
    const first = await makeController('code');
    const parked = await first.createSession({ id: 'session-1', ownerId: 'owner-1' });
    await parked.thread.create();
    const threadId = parked.thread.getId()!;
    await parked.sendMessage({ content: 'Read /x' });

    const second = await makeController('code');
    const reopened = await second.createSession({ id: 'session-1', ownerId: 'owner-1', threadId } as never);
    const agent = reopened.machinery.getAgent();
    const list = vi
      .spyOn(agent, 'listSuspendedRuns')
      .mockResolvedValue({ runs: [], total: 1_000_000 } as Awaited<ReturnType<typeof agent.listSuspendedRuns>>);

    await reopened.restoreStoredToolSuspension('call-unknown');
    expect(list).toHaveBeenCalledTimes(10);
  });

  it.each([
    { total: 1_000, duplicatePage: 9, accepted: false },
    { total: 1_001, duplicatePage: 10, accepted: false },
    { total: 1_000, duplicatePage: undefined, accepted: true },
  ])('restores only an unambiguous call after a complete scan ($total runs, duplicate page $duplicatePage)', async ({
    total,
    duplicatePage,
    accepted,
  }) => {
    const { makeController } = await setup();
    const first = await makeController('code');
    const parked = await first.createSession({ id: 'session-1', ownerId: 'owner-1' });
    await parked.thread.create();
    const threadId = parked.thread.getId()!;
    await parked.sendMessage({ content: 'Read /x' });

    const second = await makeController('code');
    const reopened = await second.createSession({ id: 'session-1', ownerId: 'owner-1', threadId } as never);
    const agent = reopened.machinery.getAgent();
    const stored = await agent.listSuspendedRuns({ threadId, resourceId: reopened.identity.getResourceId() });
    const run = stored.runs[0]!;
    const list = vi.spyOn(agent, 'listSuspendedRuns').mockImplementation(async ({ page = 0 }) => ({
      total,
      runs:
        page === 0
          ? [run]
          : page === duplicatePage
            ? [{ ...run, runId: 'duplicate-run' }]
            : [],
    }));

    await reopened.restoreStoredToolSuspension('call-1');
    expect(list).toHaveBeenCalledTimes(10);
    expect(reopened.claimToolSuspension('call-1').accepted).toBe(accepted);
  });
});
