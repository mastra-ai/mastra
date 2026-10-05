import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { MastraLanguageModelV2Mock } from '../test-utils/llm-mock';
import { submitPlanTool } from '../tools/builtin/submit-plan';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';

type AgentControllerTestState = { currentModelId?: string };

const agent = () =>
  new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

function createToolCallStream({
  toolCallId,
  toolName,
  input,
}: {
  toolCallId: string;
  toolName: string;
  input: string;
}) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'tool-call', toolCallId, toolName, input, providerExecuted: false });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

function createTextStream(text: string) {
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
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

async function buildController(storage: InMemoryStore): Promise<{
  controller: AgentController<AgentControllerTestState>;
  session: Session<AgentControllerTestState>;
  agents: { build: Agent; plan: Agent };
}> {
  const buildAgent = agent();
  const planAgent = agent();
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
        agent: buildAgent,
      },
      {
        id: 'plan',
        name: 'Plan',
        defaultModelId: 'openai/gpt-5.2-codex',
        agent: planAgent,
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
  return { controller, session, agents: { build: buildAgent, plan: planAgent } };
}

describe('AgentController single-model persistence across restarts', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('keeps the selected model when switching modes', async () => {
    const { session } = await buildController(storage);
    await session.thread.create();
    await session.model.switch({ modelId: 'anthropic/claude-opus-4-6' });

    await session.mode.switch({ modeId: 'fast' });

    expect(session.mode.get()).toBe('fast');
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('restores currentModelId on reopen', async () => {
    const { session: session1 } = await buildController(storage);
    const thread = await session1.thread.create();
    await session1.model.switch({ modelId: 'cerebras/qwen-3-coder-480b' });
    await session1.mode.switch({ modeId: 'fast' });

    const { session: session2 } = await buildController(storage);
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/qwen-3-coder-480b');
  });

  it('restores a legacy modeModelId key when currentModelId is absent', async () => {
    const { session: session1 } = await buildController(storage);
    const thread = await session1.thread.create();
    const memory = await storage.getStore('memory');
    await memory!.updateThread({
      id: thread.id,
      title: 'legacy thread',
      metadata: {
        currentModeId: 'fast',
        currentModelId: null,
        modeModelId_fast: 'cerebras/qwen-3-coder-480b',
      },
    });

    const { session: session2 } = await buildController(storage);
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/qwen-3-coder-480b');
  });

  it('falls back to the restored mode default when no model is persisted', async () => {
    const { session: session1 } = await buildController(storage);
    const thread = await session1.thread.create();
    const memory = await storage.getStore('memory');
    await memory!.updateThread({
      id: thread.id,
      title: 'defaulted thread',
      metadata: { currentModeId: 'fast', currentModelId: null },
    });

    const { session: session2 } = await buildController(storage);
    await session2.thread.switch({ threadId: thread.id });

    expect(session2.mode.get()).toBe('fast');
    expect(session2.model.get()).toBe('cerebras/zai-glm-4.7');
  });

  it('emits mode_changed with the correct previousModeId when restoring a mode from thread metadata', async () => {
    const { session: session1 } = await buildController(storage);
    const planThread = await session1.thread.create();
    await session1.mode.switch({ modeId: 'plan' });

    const { session: session2 } = await buildController(storage);
    session2.mode.set({ modeId: 'build' });

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

  it.each([true, false])(
    'keeps using the plan-mode agent when a resumed submit_plan run suspends again after switching to build (controller storage: %s)',
    async hasStorage => {
      let planCalls = 0;
      let buildCalls = 0;
      const planAgent = new Agent({
        id: 'plan-agent',
        name: 'plan-agent',
        instructions: 'You plan work.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            planCalls += 1;
            return {
              stream:
                planCalls <= 2
                  ? createToolCallStream({
                      toolCallId: `plan-call-${planCalls}`,
                      toolName: 'submit_plan',
                      input: '{"path":"plan.md"}',
                    })
                  : createTextStream('Plan approved.'),
            };
          },
        }),
        tools: { submit_plan: submitPlanTool },
      });
      const buildAgent = new Agent({
        id: 'build-agent',
        name: 'build-agent',
        instructions: 'You implement work.',
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            buildCalls += 1;
            return { stream: createTextStream('Implementation complete.') };
          },
        }),
      });
      const planResume = vi.spyOn(planAgent, 'sendStreamResume');
      const buildResume = vi.spyOn(buildAgent, 'sendStreamResume');
      const controller = new AgentController<AgentControllerTestState>({
        workspace: createMockWorkspace(),
        id: 'test-controller',
        ...(hasStorage ? { storage } : {}),
        initialState: { yolo: true } as any,
        modes: [
          { id: 'plan', name: 'Plan', default: true, transitionsTo: 'build', agent: planAgent },
          { id: 'build', name: 'Build', agent: buildAgent },
        ],
      });
      await controller.init();
      const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
      await session.thread.create();

      const events: any[] = [];
      session.subscribe(event => {
        events.push(event);
      });
      await session.sendMessage({ content: 'Create a plan' });
      const suspended = events.find(event => event.type === 'tool_suspended');
      expect(suspended?.toolCallId).toBe('plan-call-1');

      events.length = 0;
      await session.respondToToolSuspension({ toolCallId: suspended.toolCallId, resumeData: { action: 'approved' } });

      const resuspended = events.find(event => event.type === 'tool_suspended');
      expect(resuspended?.toolCallId).toBe('plan-call-2');
      expect(planCalls).toBe(2);
      expect(planResume).toHaveBeenCalledTimes(1);
      expect(buildResume).not.toHaveBeenCalled();
      expect(session.mode.get()).toBe('build');

      events.length = 0;
      await session.respondToToolSuspension({ toolCallId: resuspended.toolCallId, resumeData: { action: 'approved' } });

      expect(planCalls).toBe(2);
      expect(planResume).toHaveBeenCalledTimes(2);
      expect(buildResume).not.toHaveBeenCalled();
      expect(events.some(event => event.type === 'error')).toBe(false);
    },
  );
});
