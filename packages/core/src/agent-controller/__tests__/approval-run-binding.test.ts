/**
 * Regression test: a tool approval must be resolved against the run that raised
 * it, not the session's currently-bound thread.
 *
 * `SessionThread.switch()` rebinds the session to the new thread (and
 * `Session.thread.set()` does the same directly) while the run engine is still
 * holding a chunk stream for the *original* thread. The agent locates a
 * suspended run by `threadId` and defaults the resumed run's `memory.thread` to
 * it, so resolving the approval with the newly-bound thread either fails to find
 * the run or resumes it against the wrong thread — stranding the parked call.
 *
 * The engine therefore forwards its own thread/run/resource/agent/abort-signal
 * binding on every resolution path. These tests pin that: the agent must be
 * asked to approve on the run's thread, under the run's resource, through the
 * run's own agent, and with the run's own abort signal — even after the session
 * has moved on.
 */
import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import type { Session } from '../session';
import { createMockWorkspace } from '../test-utils';

function createController() {
  const agent = new Agent({
    id: 'approval-binding-agent',
    name: 'approval-binding-agent',
    instructions: 'Test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' } as any,
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'approval-binding-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });

  return { controller, agent };
}

function createControllerWithPlanMode() {
  const buildAgent = new Agent({
    id: 'approval-binding-build-agent',
    name: 'approval-binding-build-agent',
    instructions: 'Test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' } as any,
  });
  const planAgent = new Agent({
    id: 'approval-binding-plan-agent',
    name: 'approval-binding-plan-agent',
    instructions: 'Test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' } as any,
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'approval-binding-modes-controller',
    storage: new InMemoryStore(),
    modes: [
      { id: 'default', name: 'Default', default: true, agent: buildAgent },
      { id: 'plan', name: 'Plan', agent: planAgent },
    ],
  });

  return { controller, buildAgent, planAgent };
}

const toolCallApprovalChunk = () => ({
  type: 'tool-call-approval',
  runId: 'run-a',
  payload: { toolCallId: 'tool-call-1', toolName: 'edit_file', args: {} },
});

const finishChunk = () => ({
  type: 'finish',
  runId: 'run-a',
  payload: { stepResult: { reason: 'stop' } },
});

/**
 * Drives `processSubscribedThreadStream` with a scripted chunk list. An entry of
 * the form `{ __effect }` is not yielded — it runs between chunks, which is how
 * these tests simulate the session rebinding to another thread mid-run.
 */
async function processSubscribedChunks(session: Session<any>, chunks: any[], activeRunId = 'run-a') {
  const subscription = {
    stream: (async function* () {
      for (const chunk of chunks) {
        if (chunk.__effect) {
          await chunk.__effect();
          continue;
        }
        yield chunk;
      }
    })(),
    activeRunId: () => activeRunId,
    __getCurrentRunRequestContext: () => undefined,
    abort: () => {},
    unsubscribe: () => {},
  };

  session.stream.attach({ subscription: subscription as any, key: 'test-agent:test-resource:thread-a' });
  await session.processSubscribedThreadStream(subscription as any);
}

describe('tool approvals resolve against the run that raised them', () => {
  it('approves on the run thread when the session switched thread mid-run', async () => {
    const { controller, agent } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'thread-a' });

    vi.spyOn(session, 'resolveToolApproval').mockReturnValue('allow');
    const sendToolApproval = vi.spyOn(agent, 'sendToolApproval').mockResolvedValue({ accepted: true, runId: 'run-a' });

    await processSubscribedChunks(session, [
      { type: 'start', runId: 'run-a' },
      { __effect: () => session.thread.set({ threadId: 'thread-b' }) },
      toolCallApprovalChunk(),
      finishChunk(),
    ]);

    // The session really did move on to another thread...
    expect(session.thread.getId()).toBe('thread-b');
    // ...but the approval is still routed to the thread that owns the run.
    expect(sendToolApproval).toHaveBeenCalledTimes(1);
    expect(sendToolApproval.mock.calls[0]?.[0].threadId).toBe('thread-a');
    expect(sendToolApproval.mock.calls[0]?.[0].approved).toBe(true);
  });

  it('resolves a parked gate on the run thread after the session switched thread', async () => {
    const { controller, agent } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'thread-a' });

    vi.spyOn(session, 'resolveToolApproval').mockReturnValue('ask');
    const sendToolApproval = vi.spyOn(agent, 'sendToolApproval').mockResolvedValue({ accepted: true, runId: 'run-a' });

    let responded = false;
    session.subscribe(event => {
      if (event.type !== 'tool_approval_required' || responded) return;
      responded = true;
      // The user answers the dialog after navigating to a different thread.
      session.thread.set({ threadId: 'thread-b' });
      session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
    });

    await processSubscribedChunks(session, [{ type: 'start', runId: 'run-a' }, toolCallApprovalChunk(), finishChunk()]);

    expect(responded).toBe(true);
    expect(session.thread.getId()).toBe('thread-b');
    expect(sendToolApproval).toHaveBeenCalledTimes(1);
    expect(sendToolApproval.mock.calls[0]?.[0].threadId).toBe('thread-a');
    expect(sendToolApproval.mock.calls[0]?.[0].runId).toBe('run-a');
    expect(sendToolApproval.mock.calls[0]?.[0].toolCallId).toBe('tool-call-1');
    expect(sendToolApproval.mock.calls[0]?.[0].approved).toBe(true);
  });

  it('resolves a parked gate under the run resource after the session was re-scoped', async () => {
    const { controller, agent } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'thread-a' });
    const runResourceId = session.identity.getResourceId();

    vi.spyOn(session, 'resolveToolApproval').mockReturnValue('ask');
    const sendToolApproval = vi.spyOn(agent, 'sendToolApproval').mockResolvedValue({ accepted: true, runId: 'run-a' });

    let responded = false;
    session.subscribe(event => {
      if (event.type !== 'tool_approval_required' || responded) return;
      responded = true;
      // The host re-scopes the session to another resource while the gate is
      // still parked. The production path tears the subscription down and resets
      // the run tracker, but does not abort the run, so the engine still has to
      // settle this call afterwards.
      void controller
        .setResourceId(session, { resourceId: 'resource-b' })
        .then(() => session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId }));
    });

    await processSubscribedChunks(session, [{ type: 'start', runId: 'run-a' }, toolCallApprovalChunk(), finishChunk()]);

    expect(responded).toBe(true);
    // The session really did move on to another resource...
    expect(session.identity.getResourceId()).toBe('resource-b');
    // ...but the approval is still filed under the resource that owns the run,
    // so the agent finds the suspended run and resumes its memory scope there.
    expect(sendToolApproval).toHaveBeenCalledTimes(1);
    expect(sendToolApproval.mock.calls[0]?.[0].resourceId).toBe(runResourceId);
    expect(sendToolApproval.mock.calls[0]?.[0].threadId).toBe('thread-a');
    expect(sendToolApproval.mock.calls[0]?.[0].memory).toEqual({
      thread: 'thread-a',
      resource: runResourceId,
    });
  });

  it('resolves a parked gate through the agent that owns the run after a mode switch', async () => {
    const { controller, buildAgent, planAgent } = createControllerWithPlanMode();
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'thread-a' });

    vi.spyOn(session, 'resolveToolApproval').mockReturnValue('ask');
    const buildApproval = vi
      .spyOn(buildAgent, 'sendToolApproval')
      .mockResolvedValue({ accepted: true, runId: 'run-a' });
    const planApproval = vi.spyOn(planAgent, 'sendToolApproval').mockResolvedValue({ accepted: true, runId: 'run-a' });

    let responded = false;
    session.subscribe(event => {
      if (event.type !== 'tool_approval_required' || responded) return;
      responded = true;
      // A mode switch replaces `machinery.getAgent()` while the gate stays
      // parked, but only the agent holding this run's snapshot can reclaim it.
      void session.mode
        .switch({ modeId: 'plan' })
        .then(() => session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId }));
    });

    await processSubscribedChunks(session, [{ type: 'start', runId: 'run-a' }, toolCallApprovalChunk(), finishChunk()]);

    expect(responded).toBe(true);
    // The session really did move to the other mode...
    expect(session.mode.get()).toBe('plan');
    // ...but the approval went to the agent that owns the run.
    expect(buildApproval).toHaveBeenCalledTimes(1);
    expect(planApproval).not.toHaveBeenCalled();
  });

  it('settles a parked gate with the signal of the run that parked it', async () => {
    const { controller, agent } = createController();
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    session.thread.set({ threadId: 'thread-a' });

    vi.spyOn(session, 'resolveToolApproval').mockReturnValue('ask');
    const sendToolApproval = vi.spyOn(agent, 'sendToolApproval').mockResolvedValue({ accepted: true, runId: 'run-a' });

    let parkedSignal: AbortSignal | undefined;
    let successorSignal: AbortSignal | undefined;
    let responded = false;
    session.subscribe(event => {
      if (event.type !== 'tool_approval_required' || responded) return;
      responded = true;
      // A successor run takes over the session's run tracker — minting a fresh
      // controller — while this run's gate is still parked.
      session.run.reset();
      successorSignal = session.run.ensureAbortController().signal;
      session.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
    });

    await processSubscribedChunks(session, [
      { type: 'start', runId: 'run-a' },
      { __effect: () => void (parkedSignal = session.run.ensureAbortController().signal) },
      toolCallApprovalChunk(),
      finishChunk(),
    ]);

    expect(responded).toBe(true);
    expect(parkedSignal).toBeDefined();
    expect(successorSignal).toBeDefined();
    // The tracker really did hand out a different signal...
    expect(parkedSignal).not.toBe(successorSignal);
    // ...but the parked run is resumed with its own.
    expect(sendToolApproval).toHaveBeenCalledTimes(1);
    expect(sendToolApproval.mock.calls[0]?.[0].abortSignal).toBe(parkedSignal);
  });
});
