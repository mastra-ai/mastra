import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { LibSQLStore } from '@mastra/libsql';
import { describe, it, expect, vi } from 'vitest';

import { startGoalWithDefaults } from '../tui/commands/goal.js';
import { GoalManager } from '../tui/goal-manager.js';
import { runGoal } from './run-goal.js';

vi.mock('../onboarding/settings.js', () => ({
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
  const storage = new LibSQLStore({ id: 'test-store', url: 'file::memory:?cache=shared' });
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
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for goal_evaluation. Events: ${formatEventTypes(events)}`)),
      10_000,
    );
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
  });
}

function waitForEvent(events: AgentControllerEvent[], type: AgentControllerEvent['type']) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${type}. Events: ${formatEventTypes(events)}`)),
      10_000,
    );
    const interval = setInterval(() => {
      if (events.some(event => event.type === type)) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 5);
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

  it('runGoal emits terminal goal_evaluation without manual continue messages', async () => {
    const { controller, session, scorer } = await makeHarness();
    const sendMessageSpy = vi.spyOn(session, 'sendMessage');

    const run = runGoal({
      controller,
      session,
      objective: 'finish the task',
      judgeModelId: 'mock-judge',
      maxRuns: 5,
      goalManager: new GoalManager(),
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

  it('runGoal waits for terminal goal_evaluation even when agent_end arrives first', async () => {
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
        create: vi.fn(),
        setSetting: vi.fn(),
      },
      identity: { getResourceId: vi.fn(() => 'resource-1') },
    };

    const result = await runGoal({
      controller: controller as any,
      session: session as any,
      objective: 'finish after agent end',
      judgeModelId: 'mock-judge',
      maxRuns: 5,
      goalManager: new GoalManager(),
    }).result;

    expect(result).toMatchObject({
      status: 'done',
      agentEndReason: 'complete',
      reason: 'done after agent_end',
    });
    expect(session.sendMessage).not.toHaveBeenCalled();
    expect(session.sendSignal).toHaveBeenCalledTimes(1);
  });
});
