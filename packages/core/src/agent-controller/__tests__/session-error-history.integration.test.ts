import dns from 'node:dns';
import net from 'node:net';
import { setImmediate } from 'node:timers/promises';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => vi.restoreAllMocks());

it.each([
  { fails: false, holdSave: false },
  { fails: true, holdSave: false },
  { fails: false, holdSave: true },
  { fails: true, holdSave: true },
])('settles approved history before terminal events: %j', async ({ fails, holdSave }) => {
  const network = vi.fn(() => {
    throw new Error('Network is forbidden');
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(network);
  vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(network);
  vi.spyOn(dns, 'lookup').mockImplementation(network);
  const storage = new InMemoryStore();
  const memory = new Memory({ storage, options: { generateTitle: false, observationalMemory: false } });
  const reachedSave = deferred();
  const releaseSave = deferred();
  const approval = deferred();
  const terminal = deferred();
  const calls = { model: 0, tool: 0, output: [] as string[], saved: false };
  const originalError = new Error('Second model call rejected');
  originalError.name = 'ProviderRejection';
  const saveMessages = memory.saveMessages.bind(memory);
  vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
    if (
      holdSave &&
      calls.model === 2 &&
      args.messages.some(row =>
        row.content.parts.some(
          part =>
            part.type === 'tool-invocation' &&
            part.toolInvocation.toolCallId === 'approved-call' &&
            part.toolInvocation.state === 'result',
        ),
      )
    ) {
      reachedSave.resolve();
      await releaseSave.promise;
    }
    const result = await saveMessages(args);
    if (calls.model === 2) calls.saved = true;
    return result;
  });
  const durable: unknown = createDurableAgent({
    agent: new Agent({
      id: 'error-history-agent',
      name: 'Error history',
      instructions: 'Run the local lookup.',
      maxRetries: 0,
      memory,
      model: new MastraLanguageModelV2Mock({
        doStream: async () => {
          const call = ++calls.model;
          if (call > 2) throw new Error('Unexpected model call');
          if (fails && call === 2) throw originalError;
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                if (call === 1)
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: 'approved-call',
                    toolName: 'lookup',
                    input: '{}',
                  });
                else {
                  controller.enqueue({ type: 'text-start', id: 'answer' });
                  controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'Done.' });
                  controller.enqueue({ type: 'text-end', id: 'answer' });
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: call === 1 ? 'tool-calls' : 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Local lookup',
          inputSchema: z.object({}),
          requireApproval: true,
          execute: async () => {
            calls.tool++;
            return { value: 'saved-result' };
          },
        }),
      },
      outputProcessors: [
        {
          id: 'observe-final-output',
          processOutputResult: args => {
            calls.output.push(args.result?.finishReason ?? 'missing');
            return args.messageList;
          },
        },
      ],
    }),
  });
  if (!(durable instanceof Agent)) throw new TypeError('Expected native Agent');
  const controller = new AgentController({
    id: 'history-controller',
    agent: durable,
    storage,
    memory,
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
  });
  const mastra = new Mastra({
    agents: { durable },
    agentControllers: { controller },
    storage,
    logger: false,
    workers: false,
    scheduler: { enabled: false },
    recovery: { durableAgents: 'off' },
  });
  await controller.init();
  expect(controller.getMastra()).toBe(mastra);
  expect(durable.getMastraInstance()).toBe(mastra);
  expect(mastra.getAgentController('controller')).toBe(controller);
  const session = await controller.createSession({ resourceId: 'resource', threadId: 'history-thread' });
  await session.state.set({ yolo: false });
  const ends: string[] = [];
  const errors: unknown[] = [];
  const histories: Array<ReturnType<typeof session.thread.listActiveMessages>> = [];
  const savedAtEnd: boolean[] = [];
  const off = session.subscribe(event => {
    if (event.type === 'tool_approval_required') approval.resolve();
    if (event.type === 'error') errors.push(event.error);
    if (event.type === 'agent_end' && event.reason !== 'suspended') {
      ends.push(event.reason ?? 'missing');
      savedAtEnd.push(calls.saved);
      histories.push(session.thread.listActiveMessages());
      terminal.resolve();
    }
  });
  const turn = session.sendMessage({ content: 'Run the lookup.' });
  try {
    await approval.promise;
    expect(calls.tool).toBe(0);
    session.respondToToolApproval({ decision: 'approve', toolCallId: 'approved-call' });
    if (holdSave) {
      await reachedSave.promise;
      await setImmediate();
      expect(calls.output).toEqual([fails ? 'error' : 'stop']);
      expect(ends).toEqual([]);
      expect(errors).toEqual([]);
      expect(calls.saved).toBe(false);
      releaseSave.resolve();
    }
    await terminal.promise;
    await turn;
    expect(ends).toEqual([fails ? 'error' : 'complete']);
    expect(savedAtEnd).toEqual([true]);
    for (const rows of await Promise.all(histories)) {
      const row = rows.find(row =>
        row.content.parts.some(
          part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'approved-call',
        ),
      );
      expect(row?.content.metadata?.pendingToolApprovals).toBeUndefined();
      expect(row?.content.parts).toContainEqual(
        expect.objectContaining({
          type: 'tool-invocation',
          toolInvocation: expect.objectContaining({
            toolCallId: 'approved-call',
            state: 'result',
            result: { value: 'saved-result' },
          }),
        }),
      );
    }
    if (fails) expect(errors).toEqual([expect.objectContaining({ message: originalError.message })]);
    else expect(errors).toEqual([]);
    expect(calls.model).toBe(2);
    expect(calls.tool).toBe(1);
    expect(session.displayState.get().pendingApproval).toBeNull();
    expect(network).not.toHaveBeenCalled();
  } finally {
    releaseSave.resolve();
    session.abort();
    await turn.catch(() => undefined);
    off();
    await mastra.shutdown();
  }
});
