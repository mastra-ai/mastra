import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent } from '../../agent/durable';
import { DurableStepIds } from '../../agent/durable/constants';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';

afterEach(() => vi.restoreAllMocks());

describe.each(['durable', 'evented'] as const)('%s terminal error history', execution => {
  describe.each([false, true])('observational memory: %s', observationalMemory => {
    it.each(['input', 'model', 'output'] as const)(
      'retains a %s failure after controller recreation',
      async failureAt => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
        const id = randomUUID();
        const errorMessage = 'The local run failed before producing an answer.';
        const storage = new InMemoryStore();
        const memoryModelCall = vi.fn(async () => {
          throw new Error('Unexpected memory model call');
        });
        const memory = new Memory({
          storage,
          options: {
            generateTitle: false,
            observationalMemory: observationalMemory
              ? {
                  model: new MastraLanguageModelV2Mock({ doStream: memoryModelCall }),
                  scope: 'thread',
                  observation: { messageTokens: 8000, bufferTokens: 0.2 },
                  reflection: { observationTokens: 12000 },
                }
              : false,
          },
        });
        const rejectedAnswer = 'This answer must not survive output rejection.';
        const modelCall = vi.fn(async () => {
          if (failureAt !== 'output') throw new Error(errorMessage);
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'text-start', id: 'answer' });
                controller.enqueue({ type: 'text-delta', id: 'answer', delta: rejectedAnswer });
                controller.enqueue({ type: 'text-end', id: 'answer' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        });
        const base = new Agent({
          id,
          name: 'Terminal error history',
          instructions: 'Answer the request.',
          memory,
          maxRetries: 0,
          defaultOptions: observationalMemory
            ? {
                memory: {
                  options: {
                    observationalMemory: memory.getMergedThreadConfig().observationalMemory,
                  },
                },
              }
            : undefined,
          model: new MastraLanguageModelV2Mock({ doStream: modelCall }),
          inputProcessors: [
            {
              id: 'local-input-check',
              processInputStep({ messageList }) {
                if (failureAt === 'input') throw new Error(errorMessage);
                return messageList;
              },
            },
          ],
          outputProcessors: [
            {
              id: 'reject-output',
              processOutputResult({ messageList }) {
                if (failureAt === 'output') throw new Error(errorMessage);
                return messageList;
              },
            },
          ],
        });
        const agent =
          execution === 'durable' ? createDurableAgent({ agent: base }) : createEventedAgent({ agent: base });
        const options = {
          id: `${id}-controller`,
          agent,
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
        };
        const controller = new AgentController(options);
        const mastra = new Mastra({
          agents: { agent },
          agentControllers: { controller },
          storage,
          logger: false,
          workers: false,
          scheduler: { enabled: false },
          recovery: { durableAgents: 'off' },
        });
        let reopened: AgentController | undefined;
        let off: (() => void) | undefined;
        try {
          await controller.init();
          const session = await controller.createSession({ resourceId: id, threadId: id });
          const errors: string[] = [];
          const observer = await controller.createSession({ resourceId: id, threadId: id, scope: 'observer' });
          expect(observer).not.toBe(session);
          let observedEnd!: () => void;
          const observerEnded = new Promise<void>(resolve => {
            observedEnd = resolve;
          });
          observer.subscribe(event => {
            if (event.type === 'agent_end') observedEnd();
          });
          const saveMessages = vi.spyOn(memory, 'saveMessages');
          const reasons: string[] = [];
          let end!: () => void;
          const ended = new Promise<void>(resolve => {
            end = resolve;
          });
          off = session.subscribe(event => {
            if (event.type === 'error') errors.push(event.error.message);
            if (event.type === 'agent_end') {
              reasons.push(event.reason ?? 'missing');
              end();
            }
          });
          await session.sendMessage({ content: 'Run the local check.' });
          await Promise.all([ended, observerEnded]);
          expect(errors.some(message => message.includes(errorMessage))).toBe(true);
          expect(reasons).toEqual(['error']);
          expect(modelCall).toHaveBeenCalledTimes(failureAt === 'input' ? 0 : 1);
          expect(session.run.isRunning()).toBe(false);
          const saved = await session.thread.listActiveMessages();
          off();
          await controller.destroy();
          reopened = new AgentController({ ...options, id: `${id}-reopened` });
          await reopened.init();
          const coldSession = await reopened.createSession({ resourceId: id, threadId: id });
          const history = await coldSession.thread.listActiveMessages();
          expect(history.map(row => row.id)).toEqual(saved.map(row => row.id));
          expect(history.some(row => String(row.content.metadata?.errorMessage ?? '').includes(errorMessage))).toBe(
            true,
          );
          expect(history.filter(row => row.content.metadata?.stopReason === 'error')).toHaveLength(1);
          expect(
            saveMessages.mock.calls.filter(([args]) =>
              args.messages.some(row => row.content.parts.some(part => part.type === 'data-error')),
            ),
          ).toHaveLength(1);
          expect(JSON.stringify(history)).not.toContain(rejectedAnswer);
          expect(network).not.toHaveBeenCalled();
          expect(memoryModelCall).not.toHaveBeenCalled();
          if (observationalMemory && failureAt !== 'input') {
            const memoryStore = await storage.getStore('memory');
            expect(await memoryStore!.getObservationalMemory(id, id)).not.toBeNull();
          }
        } finally {
          off?.();
          await reopened?.destroy();
          await mastra.shutdown();
        }
      },
    );
  });

  it.each(['input', 'model'] as const)(
    'exposes failure to save a %s error without repeating the run',
    async failureAt => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
      const id = randomUUID();
      const storage = new InMemoryStore();
      const memory = new Memory({ storage, options: { generateTitle: false, observationalMemory: false } });
      const originalSave = memory.saveMessages.bind(memory);
      let failureWrites = 0;
      vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
        if (args.messages.some(row => row.content.parts.some(part => part.type === 'data-error'))) {
          failureWrites++;
          throw new Error('Failure storage unavailable');
        }
        return originalSave(args);
      });
      const modelCall = vi.fn(async () => {
        throw new Error('Original run failure');
      });
      const base = new Agent({
        id,
        name: 'Failure save check',
        instructions: 'Run the check.',
        memory,
        maxRetries: 0,
        model: new MastraLanguageModelV2Mock({ doStream: modelCall }),
        inputProcessors: [
          {
            id: 'local-failure',
            processInputStep({ messageList }) {
              if (failureAt === 'input') throw new Error('Original run failure');
              return messageList;
            },
          },
        ],
      });
      const agent = execution === 'durable' ? createDurableAgent({ agent: base }) : createEventedAgent({ agent: base });
      const controller = new AgentController({
        id,
        agent,
        memory,
        storage,
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
        agents: { agent },
        agentControllers: { controller },
        storage,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      try {
        await controller.init();
        const session = await controller.createSession({ resourceId: id, threadId: id });
        const errors: string[] = [];
        let failedRunId: string | null = null;
        let end!: () => void;
        const ended = new Promise<void>(resolve => {
          end = resolve;
        });
        session.subscribe(event => {
          if (event.type === 'error') {
            errors.push(event.error.message);
            failedRunId = session.getCurrentRunId();
          }
          if (event.type === 'agent_end') {
            expect(event.reason).toBe('error');
            end();
          }
        });
        await session.sendMessage({ content: 'Run this once.' });
        await ended;
        expect(errors.join('\n')).toContain('Original run failure');
        expect(errors.join('\n')).toContain('Failure storage unavailable');
        expect(failureWrites).toBe(1);
        expect(session.run.isRunning()).toBe(false);
        expect((await agent.listActiveRuns()).runs).toHaveLength(0);
        expect(failedRunId).toBeTruthy();
        const workflows = await storage.getStore('workflows');
        const retained = await workflows!.getWorkflowRunById({
          runId: failedRunId!,
          workflowName: DurableStepIds.AGENTIC_LOOP,
        });
        const snapshot = typeof retained?.snapshot === 'string' ? JSON.parse(retained.snapshot) : retained?.snapshot;
        expect(snapshot?.status).toBe('failed');
        await agent.recoverActiveRuns();
        expect(modelCall).toHaveBeenCalledTimes(failureAt === 'input' ? 0 : 1);
        expect(network).not.toHaveBeenCalled();
      } finally {
        await mastra.shutdown();
      }
    },
  );
});
