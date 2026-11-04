/**
 * Suspension lifecycle tests for `runMC`.
 *
 * The fake session replays the event order the AgentController emits for a
 * suspending tool: `tool_suspended` is emitted while the stream is still being
 * consumed, then the run settles with `agent_end { reason: 'suspended' }`.
 * Resuming a parked tool starts a fresh run with its own `agent_start` and
 * `agent_end`, just as `Session.respondToToolSuspension` does.
 */
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { describe, it, expect, vi } from 'vitest';

import { autoApprovePolicy, denyPolicy } from './policy.js';
import { runMC } from './run-mc.js';
import type { RunMCOptions } from './types.js';

vi.mock('@mastra/core/agent-controller', () => ({ isSessionStartupCancelledError: () => false }));
vi.mock('../auth/account-rotation-processor.js', () => ({ MODEL_FALLBACK_STATE_KEY: 'modelFallback' }));
vi.mock('../goal-manager.js', () => ({ GoalManager: vi.fn() }));
vi.mock('../goal-signal.js', () => ({ createGoalReminderSignal: vi.fn() }));
vi.mock('../onboarding/settings.js', () => ({ THREAD_ACTIVE_MODEL_PACK_ID_KEY: 'activeModelPackId' }));

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

interface FakeSessionOptions {
  /** Tool calls the first run parks; resuming one re-ends the run suspended while others stay parked. */
  suspendedToolCallIds?: string[];
  /** A suspension Core cancels before the run ends. */
  cancelledToolCallId?: string;
  /** Whether `respondToToolSuspension` finds the parked suspension and resumes it. */
  resumable?: boolean;
  /** Whether the resumed run hangs until it is aborted. */
  resumedRunHangs?: boolean;
}

function createFakeSession({
  suspendedToolCallIds = ['access-1'],
  cancelledToolCallId,
  resumable = true,
  resumedRunHangs = false,
}: FakeSessionOptions = {}) {
  let listener: ((event: AgentControllerEvent) => void) | undefined;
  const emit = (event: Record<string, unknown>) => listener?.(event as AgentControllerEvent);
  const parked = new Map<string, Omit<Extract<AgentControllerEvent, { type: 'tool_suspended' }>, 'type'>>();
  const responses: Array<{ toolCallId?: string; resumeData: unknown; parked: boolean }> = [];
  let unsubscribed = false;
  // The session resets run state right after emitting agent_end, so a resume
  // issued from inside that emit would race the reset.
  let endingRun = false;
  let respondedWhileEnding = 0;
  // A resumed run cannot start until the run that parked the tool has settled.
  let settleFirstRun!: () => void;
  const firstRunSettled = new Promise<void>(resolve => {
    settleFirstRun = resolve;
  });

  async function startRun() {
    emit({ type: 'agent_start' });
    for (const toolCallId of suspendedToolCallIds) {
      emit({ type: 'tool_start', toolCallId, toolName: 'request_access', args: { path: '/shared' } });
      // The suspension is registered before it is emitted, and the run only
      // settles once the stream loop has broken out.
      const suspension = {
        toolCallId,
        toolName: 'request_access',
        args: { path: '/shared' },
        suspendPayload: { path: '/shared' },
      };
      parked.set(toolCallId, suspension);
      emit({ type: 'tool_suspended', ...suspension });
    }
    if (cancelledToolCallId) {
      parked.delete(cancelledToolCallId);
      emit({
        type: 'tool_suspension_cancelled',
        toolCallId: cancelledToolCallId,
        toolName: 'request_access',
        reason: 'cancelled',
      });
    }
    await tick();
    endingRun = true;
    emit({ type: 'agent_end', reason: 'suspended' });
    endingRun = false;
    settleFirstRun();
  }

  const session = {
    displayState: { get: () => ({ pendingSuspensions: parked }) },
    identity: { getResourceId: () => undefined },
    thread: { getId: () => 'thread-1', create: async () => {}, getById: async () => ({ id: 'thread-1' }) },
    subscribe(fn: (event: AgentControllerEvent) => void) {
      listener = fn;
      return () => {
        unsubscribed = true;
      };
    },
    abort: vi.fn(() => {
      parked.clear();
      if (!endingRun) emit({ type: 'agent_end', reason: 'aborted' });
    }),
    sendMessage: startRun,
    sendSignal: () => ({ accepted: startRun() }),
    async respondToToolSuspension({ toolCallId, resumeData }: { toolCallId?: string; resumeData: unknown }) {
      if (endingRun) respondedWhileEnding += 1;
      responses.push({ toolCallId, resumeData, parked: !!toolCallId && parked.has(toolCallId) });
      if (!resumable || !toolCallId || !parked.delete(toolCallId)) {
        // Display bookkeeping can still be emitted while no run starts.
        emit({ type: 'display_state_changed', displayState: {} });
        return;
      }
      await firstRunSettled;
      await tick();
      emit({ type: 'agent_start' });
      if (resumedRunHangs) return;
      emit({ type: 'tool_end', toolCallId, result: 'Access granted', isError: false });
      endingRun = true;
      emit({ type: 'agent_end', reason: parked.size > 0 ? 'suspended' : 'complete' });
      endingRun = false;
    },
  };

  return {
    session,
    responses,
    isUnsubscribed: () => unsubscribed,
    respondedWhileEnding: () => respondedWhileEnding,
  };
}

function run(session: ReturnType<typeof createFakeSession>['session'], options: Partial<RunMCOptions> = {}) {
  return runMC({
    controller: {} as RunMCOptions['controller'],
    session: session as unknown as RunMCOptions['session'],
    prompt: 'read /shared',
    timeoutMs: 5_000,
    ...options,
  } as RunMCOptions);
}

describe('runMC suspension lifecycle', () => {
  it('resumes a suspension the policy answered and completes after the resumed run', async () => {
    const fake = createFakeSession();
    const events: string[] = [];
    const handle = run(fake.session);
    for await (const event of handle)
      events.push(event.type === 'agent_end' ? `agent_end:${event.reason}` : event.type);
    const result = await handle.result;

    expect(fake.responses).toEqual([{ toolCallId: 'access-1', resumeData: 'Yes', parked: true }]);
    expect(fake.respondedWhileEnding()).toBe(0);
    expect(result.status).toBe('completed');
    expect(result.exitCode).toBe(0);
    expect(result.finishReason).toBe('complete');
    expect(result.toolResults).toEqual([
      { id: 'access-1', name: 'request_access', result: 'Access granted', isError: false },
    ]);
    expect(events).toContain('agent_end:suspended');
    expect(events.at(-1)).toBe('agent_end:complete');
  });

  it('fails instead of completing when the suspension cannot be resumed', async () => {
    const fake = createFakeSession({ resumable: false });
    const result = await run(fake.session).result;

    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.finishReason).toBe('suspended');
    expect(result.error?.message).toMatch(/unresolved request_access suspension/);
    expect(result.toolResults).toEqual([]);
    expect(fake.isUnsubscribed()).toBe(true);
  });

  it('resumes only parked suspensions one at a time until none are left', async () => {
    const fake = createFakeSession({
      suspendedToolCallIds: ['cancelled', 'access-1', 'access-2'],
      cancelledToolCallId: 'cancelled',
    });
    const onSuspension = vi.fn(autoApprovePolicy.onSuspension);
    const result = await run(fake.session, { policy: { ...autoApprovePolicy, onSuspension } }).result;

    expect(fake.responses).toEqual([
      { toolCallId: 'access-1', resumeData: 'Yes', parked: true },
      { toolCallId: 'access-2', resumeData: 'Yes', parked: true },
    ]);
    expect(fake.respondedWhileEnding()).toBe(0);
    expect(onSuspension.mock.calls.map(([event]) => event.toolCallId)).toEqual(['access-1', 'access-2']);
    expect(result.status).toBe('completed');
    expect(result.finishReason).toBe('complete');
    expect(result.toolResults.map(r => r.id)).toEqual(['access-1', 'access-2']);
  });

  it('fails when the run ends suspended with no suspension to answer', async () => {
    const fake = createFakeSession({ suspendedToolCallIds: [] });
    const result = await run(fake.session).result;

    expect(fake.responses).toEqual([]);
    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.error?.message).toMatch(/unresolved tool suspension/);
  });

  it('fails a goal run left suspended instead of waiting for a goal evaluation', async () => {
    const fake = createFakeSession({ resumable: false });
    const objective = { id: 'goal-1' };
    const result = await run(fake.session, {
      prompt: undefined,
      controller: { getCurrentAgent: () => ({ getObjective: async () => objective }) } as RunMCOptions['controller'],
      goal: {
        objective: 'read /shared',
        judgeModelId: 'judge',
        maxRuns: 1,
        goalManager: { setGoal: async () => objective, saveToThread: async () => {} } as any,
      },
    }).result;

    expect(result.status).toBe('error');
    expect(result.exitCode).toBe(1);
    expect(result.error?.message).toMatch(/unresolved request_access suspension/);
  });

  it('times out when the resumed run never finishes', async () => {
    const fake = createFakeSession({ resumedRunHangs: true });
    const result = await run(fake.session, { timeoutMs: 50 }).result;

    expect(fake.responses).toHaveLength(1);
    expect(fake.session.abort).toHaveBeenCalled();
    expect(result.status).toBe('timeout');
    expect(result.exitCode).toBe(2);
  });

  it('still aborts without resuming when the policy aborts on suspension', async () => {
    const fake = createFakeSession();
    const result = await run(fake.session, { policy: denyPolicy }).result;

    expect(fake.responses).toEqual([]);
    expect(fake.session.abort).toHaveBeenCalled();
    expect(result.status).toBe('aborted');
    expect(result.exitCode).toBe(1);
  });
});
