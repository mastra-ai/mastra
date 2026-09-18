/**
 * Stop on a durable run parked on a tool suspension (a question to the user, a
 * generation) must free the thread: a message sent after Stop starts its own
 * run and is answered.
 */
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { askUserTool } from '../../tools/builtin/ask-user';
import { Workspace } from '../../workspace';
import { AgentController } from '../agent-controller';

vi.setConfig({ testTimeout: 30_000 });

function askUserCall() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'ask', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-ask',
        toolName: 'ask_user',
        input: JSON.stringify({ question: 'Red or blue?' }),
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

function answer(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: `answer-${text}`, modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text' });
      controller.enqueue({ type: 'text-delta', id: 'text', delta: text });
      controller.enqueue({ type: 'text-end', id: 'text' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

async function createHarness(id: string) {
  const prompts: unknown[] = [];
  const storage = new InMemoryStore();
  const agent = createDurableAgent({
    agent: new Agent({
      id: `durable-${id}`,
      name: 'Durable parked Stop',
      instructions: 'Ask the user, then answer.',
      model: new MastraLanguageModelV2Mock({
        doStream: async (options: any) => {
          prompts.push(options?.prompt);
          return { stream: prompts.length === 1 ? askUserCall() : answer(`answer ${prompts.length}`) };
        },
      }),
      tools: { ask_user: askUserTool },
    }),
  });
  const mastra = new Mastra({
    agents: { agent },
    storage,
    logger: false,
    workers: false,
    scheduler: { enabled: false },
    recovery: { durableAgents: 'off' },
  });
  await mastra.startWorkers();
  const workspace = new Workspace({ id: `workspace-${id}`, name: 'Test', skills: () => [] });
  const controller = new AgentController({
    id: `controller-${id}`,
    agent: mastra.getAgentById(agent.id),
    storage,
    workspace,
    defaultModeId: 'chat',
    modes: [{ id: 'chat', name: 'Chat', default: true }],
    disableBuiltinTools: [
      'ask_user',
      'submit_plan',
      'task_write',
      'task_update',
      'task_complete',
      'task_check',
      'subagent',
    ],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ ownerId: 'owner', resourceId: `resource-${id}`, workspace });
  await session.thread.create({ title: 'Parked Stop' });
  const ends: Array<string | undefined> = [];
  const errors: unknown[] = [];
  session.subscribe(event => {
    if (event.type === 'agent_end') ends.push(event.reason);
    if (event.type === 'error') errors.push(event.error);
  });
  return {
    session,
    prompts,
    ends,
    errors,
    async close() {
      session.abort();
      controller.stopIntervals();
      await mastra.stopWorkers();
    },
  };
}

describe('durable Session: Stop on a parked question frees the thread', () => {
  it('answers a message sent after Stop on a parked question', async () => {
    const h = await createHarness('stop-then-send');
    try {
      await h.session.sendMessage({ content: 'Ask me a color.' });
      await vi.waitFor(() => expect(h.session.displayState.get().pendingSuspensions.size).toBe(1));

      h.session.abort();
      const next = h.session.sendMessage({ content: 'Forget the color and say hello.' });
      void next.catch(() => {});

      await vi.waitFor(() => expect(h.ends.at(-1)).toBe('complete'), { timeout: 15_000 });
      expect(JSON.stringify(h.prompts.at(-1))).toContain('Forget the color and say hello.');
      expect(h.session.displayState.get().isRunning).toBe(false);
      expect(h.errors).toEqual([]);
    } finally {
      await h.close();
    }
  });
});
