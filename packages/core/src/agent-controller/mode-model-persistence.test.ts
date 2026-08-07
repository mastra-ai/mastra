import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';

type AgentControllerTestState = { currentModelId?: string };

const agent = () =>
  new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

async function buildController(
  storage: InMemoryStore,
): Promise<{ controller: AgentController<AgentControllerTestState>; session: Session<AgentControllerTestState> }> {
  const controller = new AgentController<AgentControllerTestState>({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    stateSchema: undefined,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        defaultModelId: 'openai/gpt-5.5',
        agent: agent(),
      },
      {
        id: 'plan',
        name: 'Plan',
        defaultModelId: 'openai/gpt-5.2-codex',
        agent: agent(),
      },
      {
        id: 'fast',
        name: 'Fast',
        defaultModelId: 'cerebras/zai-glm-4.7',
        agent: agent(),
      },
    ],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}

describe('AgentController mode-model persistence across restarts', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('restores the saved mode and falls back to its defaultModelId when no per-mode model was explicitly persisted', async () => {
    // Session 1: start in build, switch to fast (no explicit model change),
    // then "exit" — i.e. simulate reopening with a fresh controller pointed at
    // the same thread.
    const { session: session1 } = await buildController(storage);
    const thread = await session1.thread.create();
    expect(session1.mode.get()).toBe('build');

    await session1.mode.switch({ modeId: 'fast' });
    expect(session1.mode.get()).toBe('fast');
    expect(session1.model.get()).toBe('cerebras/zai-glm-4.7');

    // Session 2: reopen and resume the same thread.
    const { session: session2 } = await buildController(storage);
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it('restores an explicitly chosen per-mode model on reopen', async () => {
    const { session: session1 } = await buildController(storage);
    const thread = await session1.thread.create();

    await session1.mode.switch({ modeId: 'fast' });
    await session1.model.switch({ modelId: 'cerebras/qwen-3-coder-480b' });
    expect(session1.model.get()).toBe('cerebras/qwen-3-coder-480b');

    const { session: session2 } = await buildController(storage);
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/qwen-3-coder-480b');
  });

  it('keeps the default mode and its persisted model on reopen when the user never switched modes', async () => {
    const { session: session1 } = await buildController(storage);
    const thread = await session1.thread.create();
    await session1.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    const { session: session2 } = await buildController(storage);
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('build');
    expect(session2.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('emits mode_changed with the correct previousModeId when restoring a mode from thread metadata', async () => {
    const { session: session1 } = await buildController(storage);
    const planThread = await session1.thread.create();
    await session1.mode.switch({ modeId: 'plan' });

    const { session: session2 } = await buildController(storage);
    // Simulate the UI currently being in build mode before the user switches
    // to a plan-mode thread. `set` is intentional here: this test cares about
    // the restore event emitted by thread metadata hydration, not about
    // persisting another mode switch onto the original thread.
    session2.mode.set({ modeId: 'build' });
    expect(session2.mode.get()).toBe('build');

    const events: Array<{ type: 'mode_changed'; modeId: string; previousModeId: string }> = [];
    session2.subscribe(event => {
      if (event.type === 'mode_changed') {
        events.push({
          type: event.type,
          modeId: event.modeId,
          previousModeId: event.previousModeId,
        });
      }
    });

    await session2.thread.switch({ threadId: planThread.id });

    const restoreEvent = events.find(e => e.modeId === 'plan');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent?.previousModeId).toBe('build');
  });

  it('approving a submit_plan suspension switches to the default mode and clears the suspension', async () => {
    const { session } = await buildController(storage);
    await session.thread.create();
    await session.mode.switch({ modeId: 'plan' });

    // Simulate a submit_plan tool that suspended during a plan-mode run.
    session.suspensions.register({ toolCallId: 'plan-call-1', runId: 'run-1', toolName: 'submit_plan' });

    await session.respondToToolSuspension({ toolCallId: 'plan-call-1', resumeData: { action: 'approved' } });

    // Approval resumes the parked submit_plan suspension after switching to the
    // default execution mode. It must not abort the plan run before the approved
    // tool result is persisted.
    expect(session.suspensions.has({ toolCallId: 'plan-call-1' })).toBe(false);
    expect(session.mode.get()).toBe('build');
  });
});
