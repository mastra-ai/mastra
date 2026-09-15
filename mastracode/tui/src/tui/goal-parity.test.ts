import { runMC } from '@mastra/code-sdk/headless/run-mc';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { describe, it, expect, vi } from 'vitest';

import { startGoalWithDefaults } from './commands/goal.js';
import { GoalManager } from './goal-manager.js';

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: () => ({
    models: {
      goalJudgeModel: 'mock-judge',
      goalMaxTurns: 5,
    },
  }),
  saveSettings: vi.fn(),
}));

vi.setConfig({ testTimeout: 30_000 });

function textStream(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function makeHarness() {
  const storage = new InMemoryStore({ id: 'test-store' });
  const scorer = {
    id: 'goal-scorer',
    name: 'Goal Scorer',
    run: vi.fn().mockResolvedValue({ score: 1, reason: 'done' }),
  };

  const agent = new Agent({
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You answer questions.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream: textStream('Goal work is complete.') }),
    }) as any,
    memory: new MockMemory(),
    goal: {
      judge: 'mock-judge',
      maxRuns: 5,
      scorer: scorer as any,
    },
  });

  const mastra = new Mastra({ agents: { 'test-agent': agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent('test-agent');

  const controller = new AgentController({
    id: 'test-controller',
    storage,
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    modes: [
      {
        id: 'default',
        name: 'Default',
        description: 'default',
        defaultModelId: 'test',
        metadata: { default: true },
        instructions: 'You answer questions.',
      },
    ],
    initialState: { yolo: false },
  });
  (controller as any).getAgentForMode = () => registeredAgent;

  await controller.init();
  const session = await controller.createSession({ id: `s-${Math.random()}`, ownerId: 'test-owner' });
  await session.thread.create();

  return { controller, session, scorer };
}

function formatEventTypes(events: AgentControllerEvent[]) {
  return events.map(event => `${event.type}${event.type === 'error' ? `:${event.error.message}` : ''}`).join(', ');
}

function waitForTerminalGoalEvent(events: AgentControllerEvent[]) {
  return new Promise<Extract<AgentControllerEvent, { type: 'goal_evaluation' }>>((resolve, reject) => {
    const interval = setInterval(() => {
      const terminal = events.find(
        (event): event is Extract<AgentControllerEvent, { type: 'goal_evaluation' }> =>
          event.type === 'goal_evaluation' && !event.payload.pending,
      );
      if (terminal) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(terminal);
      }
    }, 5);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timed out waiting for goal_evaluation. Events: ${formatEventTypes(events)}`));
    }, 10_000);
  });
}

function waitForEvent(events: AgentControllerEvent[], type: AgentControllerEvent['type']) {
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (events.some(event => event.type === type)) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 5);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timed out waiting for ${type}. Events: ${formatEventTypes(events)}`));
    }, 10_000);
  });
}

describe('headless goal parity', () => {
  it('emits goal_evaluation when a TUI-started goal runs without manual continue messages', async () => {
    const { controller, session, scorer } = await makeHarness();
    const events: AgentControllerEvent[] = [];
    const unsubscribe = session.subscribe(event => {
      events.push(event);
    });
    const sendMessageSpy = vi.spyOn(session, 'sendMessage');

    try {
      const goalEventPromise = waitForTerminalGoalEvent(events);
      const ctx = {
        state: {
          controller,
          session,
          goalManager: new GoalManager(),
          pendingNewThread: false,
          planStartedGoalId: undefined,
          ui: { showOverlay: vi.fn(), hideOverlay: vi.fn() },
        },
        authStorage: {},
        updateStatusLine: vi.fn(),
        showInfo: vi.fn(),
        showError: vi.fn(),
      } as any;

      await startGoalWithDefaults(ctx, 'finish the task');
      const terminalGoalEvent = await goalEventPromise;
      await waitForEvent(events, 'agent_end');

      expect(sendMessageSpy).not.toHaveBeenCalled();
      expect(events.map(event => event.type)).toContain('agent_start');
      expect(events.map(event => event.type)).toContain('agent_end');
      expect(terminalGoalEvent.payload).toMatchObject({
        objective: 'finish the task',
        status: 'done',
        passed: true,
      });
      expect(scorer.run).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('runMC emits terminal goal_evaluation without manual continue messages', async () => {
    const { controller, session, scorer } = await makeHarness();
    const sendMessageSpy = vi.spyOn(session, 'sendMessage');

    const run = runMC({
      controller,
      session,
      goal: {
        objective: 'finish the task',
        judgeModelId: 'mock-judge',
        maxRuns: 5,
        goalManager: new GoalManager(),
      },
    });
    const result = await run.result;

    expect(result).toMatchObject({
      status: 'done',
      objective: 'finish the task',
      exitCode: 0,
    });
    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(scorer.run).toHaveBeenCalledTimes(1);
  });

  it('runMC creates a persisted thread when the session is bound to a missing thread', async () => {
    const { controller, session, scorer } = await makeHarness();
    session.thread.set({ threadId: 'missing-thread' });

    const run = runMC({
      controller,
      session,
      goal: {
        objective: 'finish on a fresh thread',
        judgeModelId: 'mock-judge',
        maxRuns: 5,
        goalManager: new GoalManager(),
      },
    });
    const result = await run.result;

    expect(result.status).toBe('done');
    expect(result.threadId).not.toBe('missing-thread');
    expect(await session.thread.getById({ threadId: result.threadId! })).not.toBeNull();
    expect(scorer.run).toHaveBeenCalledTimes(1);
  });

  it('runMC waits for terminal goal_evaluation even when agent_end arrives first', async () => {
    let listener: ((event: AgentControllerEvent) => void) | undefined;
    const objectiveRecord = {
      id: 'goal-1',
      objective: 'finish after agent end',
      status: 'active' as const,
      runsUsed: 0,
      maxRuns: 5,
      judgeModelId: 'mock-judge',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    const fakeAgent = {
      setObjective: vi.fn().mockResolvedValue(objectiveRecord),
      getObjective: vi.fn().mockResolvedValue(objectiveRecord),
      updateObjectiveOptions: vi.fn().mockResolvedValue(objectiveRecord),
    };
    const controller = {
      getCurrentAgent: vi.fn(() => fakeAgent),
      setResourceId: vi.fn(),
    };
    const session = {
      subscribe: vi.fn((handler: (event: AgentControllerEvent) => void) => {
        listener = handler;
        return vi.fn();
      }),
      sendSignal: vi.fn(() => ({
        accepted: Promise.resolve().then(() => {
          listener?.({ type: 'agent_end', reason: 'complete' } as AgentControllerEvent);
          listener?.({
            type: 'goal_evaluation',
            payload: {
              pending: false,
              objective: 'finish after agent end',
              status: 'done',
              passed: true,
              iteration: 1,
              maxRuns: 5,
              reason: 'done after agent_end',
              results: [{ score: 1, reason: 'done after agent_end' }],
            },
          } as AgentControllerEvent);
        }),
      })),
      sendMessage: vi.fn(),
      abort: vi.fn(),
      thread: {
        getId: vi.fn(() => 'thread-1'),
        getById: vi.fn().mockResolvedValue({ id: 'thread-1' }),
        create: vi.fn(),
        setSetting: vi.fn(),
      },
      identity: { getResourceId: vi.fn(() => 'resource-1') },
    };

    const result = await runMC({
      controller: controller as any,
      session: session as any,
      goal: {
        objective: 'finish after agent end',
        judgeModelId: 'mock-judge',
        maxRuns: 5,
        goalManager: new GoalManager(),
      },
    }).result;

    expect(result).toMatchObject({
      status: 'done',
      finishReason: 'complete',
      reason: 'done after agent_end',
    });
    expect(session.sendMessage).not.toHaveBeenCalled();
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('runMC errors instead of sending a signal when objective persistence falls back locally', async () => {
    let listener: ((event: AgentControllerEvent) => void) | undefined;
    const fakeAgent = {
      setObjective: vi.fn().mockResolvedValue(undefined),
      getObjective: vi.fn().mockResolvedValue(undefined),
      updateObjectiveOptions: vi.fn(),
    };
    const controller = {
      getCurrentAgent: vi.fn(() => fakeAgent),
      setResourceId: vi.fn(),
    };
    const session = {
      subscribe: vi.fn((handler: (event: AgentControllerEvent) => void) => {
        listener = handler;
        return vi.fn();
      }),
      sendSignal: vi.fn(() => ({ accepted: Promise.resolve() })),
      sendMessage: vi.fn(),
      abort: vi.fn(),
      thread: {
        getId: vi.fn(() => 'thread-1'),
        getById: vi.fn().mockResolvedValue({ id: 'thread-1' }),
        create: vi.fn(),
        setSetting: vi.fn(),
      },
      identity: { getResourceId: vi.fn(() => 'resource-1') },
    };

    const result = await runMC({
      controller: controller as any,
      session: session as any,
      goal: {
        objective: 'finish the task',
        judgeModelId: 'mock-judge',
        maxRuns: 5,
        goalManager: new GoalManager(),
      },
    }).result;

    expect(listener).toBeTypeOf('function');
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('Failed to persist goal objective');
    expect(session.sendSignal).not.toHaveBeenCalled();
    expect(session.sendMessage).not.toHaveBeenCalled();
  });
});
