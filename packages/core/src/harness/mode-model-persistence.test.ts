import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

type HarnessTestState = { currentModelId?: string };

const agent = () =>
  new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

function createHarness(storage: InMemoryStore): Harness<HarnessTestState> {
  return new Harness<HarnessTestState>({
    id: 'test-harness',
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
}

describe('Harness mode-model persistence across restarts', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('restores the saved mode and falls back to its defaultModelId when no per-mode model was explicitly persisted', async () => {
    // Harness 1: start in build, switch to fast (no explicit model change),
    // then "exit" — i.e. simulate reopening with a fresh harness pointed at
    // the same thread.
    const harness1 = createHarness(storage);
    await harness1.init();
    const session1 = await harness1.createSession();
    const thread = await session1.thread.create();
    expect(session1.mode.get()).toBe('build');

    await session1.mode.switch({ modeId: 'fast' });
    expect(session1.mode.get()).toBe('fast');
    expect(session1.model.get()).toBe('cerebras/zai-glm-4.7');

    // Harness 2: reopen and resume the same thread.
    const harness2 = createHarness(storage);
    await harness2.init();
    const session2 = await harness2.createSession();
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it('restores an explicitly chosen per-mode model on reopen', async () => {
    const harness1 = createHarness(storage);
    await harness1.init();
    const session1 = await harness1.createSession();
    const thread = await session1.thread.create();

    await session1.mode.switch({ modeId: 'fast' });
    await session1.model.switch({ modelId: 'cerebras/qwen-3-coder-480b' });
    expect(session1.model.get()).toBe('cerebras/qwen-3-coder-480b');

    const harness2 = createHarness(storage);
    await harness2.init();
    const session2 = await harness2.createSession();
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/qwen-3-coder-480b');
  });

  it('keeps the default mode and its persisted model on reopen when the user never switched modes', async () => {
    const harness1 = createHarness(storage);
    await harness1.init();
    const session1 = await harness1.createSession();
    const thread = await session1.thread.create();
    await session1.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    const harness2 = createHarness(storage);
    await harness2.init();
    const session2 = await harness2.createSession();
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('build');
    expect(session2.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('emits mode_changed with the correct previousModeId when restoring a mode from thread metadata', async () => {
    const harness1 = createHarness(storage);
    await harness1.init();
    const session1 = await harness1.createSession();
    const thread = await session1.thread.create();
    await session1.mode.switch({ modeId: 'plan' });

    const harness2 = createHarness(storage);
    await harness2.init();
    const session2 = await harness2.createSession();
    // Move session2 onto a fresh build-mode thread so switching to the saved
    // plan-mode thread below produces an observable mode restoration.
    await session2.thread.create();
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

    await session2.thread.switch({ threadId: thread.id });

    const restoreEvent = events.find(e => e.modeId === 'plan');
    expect(restoreEvent).toBeDefined();
    expect(restoreEvent?.previousModeId).toBe('build');
  });

  it('approving a submit_plan suspension switches to the default mode and clears the suspension', async () => {
    const harness = createHarness(storage);
    await harness.init();
    const session = await harness.createSession();
    await session.thread.create();
    await session.mode.switch({ modeId: 'plan' });

    const controller = session.run.ensureAbortController();

    // Simulate a submit_plan tool that suspended during a plan-mode run.
    session.suspensions.register({ toolCallId: 'plan-call-1', runId: 'run-1', toolName: 'submit_plan' });

    await session.respondToToolSuspension({ toolCallId: 'plan-call-1', resumeData: { action: 'approved' } });

    // Approval abandons the parked plan suspension and switches to the default
    // (execution) mode, aborting the plan-mode run.
    expect(session.suspensions.has({ toolCallId: 'plan-call-1' })).toBe(false);
    expect(controller.signal.aborted).toBe(true);
    expect(session.mode.get()).toBe('build');
  });
});
