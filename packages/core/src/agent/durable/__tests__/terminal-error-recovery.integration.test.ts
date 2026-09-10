import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../../../memory/src';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

describe.each(['durable', 'evented'] as const)('%s recovered terminal history', execution => {
  describe.each([false, true])('history storage rejects: %s', rejectSave => {
    it.each(['input', 'model', 'output'] as const)(
      'retains a recovered %s failure',
      async failureAt => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
        const id = randomUUID();
        const instances: Mastra[] = [];
        let recovering = false;
        let modelCalls = 0;
        const failureMessage = 'Recovered execution failed';
        const rejectedAnswer = 'Unvalidated recovered answer';
        const makeAgent = (storage: InMemoryStore) => {
          const memory = new Memory({ storage, options: { generateTitle: false, observationalMemory: false } });
          const base = new Agent({
            id,
            name: id,
            instructions: 'Answer.',
            memory,
            maxRetries: 0,
            inputProcessors: [
              {
                id: 'fail-input',
                processInputStep({ messageList }) {
                  if (!recovering) throw new Error('Original process interrupted');
                  if (failureAt === 'input') throw new Error(failureMessage);
                  return messageList;
                },
              },
            ],
            outputProcessors: [
              {
                id: 'fail-output',
                processOutputResult({ messageList }) {
                  if (recovering && failureAt === 'output') throw new Error(failureMessage);
                  return messageList;
                },
              },
            ],
            model: new MastraLanguageModelV2Mock({
              doStream: async () => {
                modelCalls++;
                if (failureAt !== 'output') throw new Error(failureMessage);
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
              },
            }),
          });
          const agent =
            execution === 'durable' ? createDurableAgent({ agent: base }) : createEventedAgent({ agent: base });
          instances.push(
            new Mastra({
              agents: { agent },
              storage,
              logger: false,
              workers: false,
              scheduler: { enabled: false },
              recovery: { durableAgents: 'off' },
            }),
          );
          return { agent, memory };
        };
        let cleanup: (() => void) | undefined;
        try {
          const originalStore = new InMemoryStore();
          const original = makeAgent(originalStore);
          const workflows = (await originalStore.getStore('workflows'))!;
          type SnapshotWrite = Parameters<typeof workflows.persistWorkflowSnapshot>[0];
          let captured: SnapshotWrite | undefined;
          const persist = workflows.persistWorkflowSnapshot.bind(workflows);
          vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
            if (!captured && args.workflowName === DurableStepIds.AGENTIC_LOOP && args.snapshot.status === 'running') {
              captured = JSON.parse(JSON.stringify(args)) as SnapshotWrite;
            }
            return persist(args);
          });
          await expect(
            original.agent.generate('Recover this task.', { memory: { thread: id, resource: id } }),
          ).rejects.toThrow('Original process interrupted');
          expect(modelCalls).toBe(0);
          expect(captured?.snapshot.status).toBe('running');
          if (!captured) throw new Error('No real running snapshot captured');
          const runId = captured.runId;
          original.agent.runRegistry.cleanup(runId);
          globalRunRegistry.delete(runId);
          await instances[0]!.shutdown();

          // Restore the unmodified snapshot captured during real execution into a
          // fresh store. This exercises actual restart(), not a stubbed terminal;
          // an operating-system process restart remains separate acceptance proof.
          const restoredStore = new InMemoryStore();
          const restored = makeAgent(restoredStore);
          await restored.memory.createThread({ threadId: id, resourceId: id });
          const restoredWorkflows = (await restoredStore.getStore('workflows'))!;
          await restoredWorkflows.persistWorkflowSnapshot(captured);
          const save = restored.memory.saveMessages.bind(restored.memory);
          let failureWrites = 0;
          vi.spyOn(restored.memory, 'saveMessages').mockImplementation(async args => {
            if (args.messages.some(message => message.content.metadata?.stopReason === 'error')) {
              failureWrites++;
              if (rejectSave) throw new Error('History storage rejected');
            }
            return save(args);
          });
          recovering = true;
          const recovered = await restored.agent.recover(runId);
          cleanup = recovered.cleanup;
          const workflowExecution = globalRunRegistry.get(runId)?.workflowExecution;
          expect(workflowExecution).toBeDefined();
          // Model-step failures (including its input processor) complete the
          // workflow with an error turn. Final-output or history failures reject it.
          if (failureAt !== 'output' && !rejectSave) await workflowExecution;
          else
            await expect(workflowExecution).rejects.toThrow(rejectSave ? 'History storage rejected' : failureMessage);
          const output = await recovered.output.getFullOutput().catch(error => error);
          expect(output instanceof Error ? output.message : JSON.stringify(output)).toContain(failureMessage);
          expect(failureWrites).toBe(1);
          const history = await restoredStore.stores.memory!.listMessages({
            threadId: id,
            resourceId: id,
            perPage: false,
          });
          expect(history.messages.filter(message => message.content.metadata?.stopReason === 'error')).toHaveLength(
            rejectSave ? 0 : 1,
          );
          expect(JSON.stringify(history.messages)).not.toContain(rejectedAnswer);
          const persisted = await restoredWorkflows.getWorkflowRunById({
            runId,
            workflowName: DurableStepIds.AGENTIC_LOOP,
          });
          if (rejectSave) {
            const snapshot =
              typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
            expect(snapshot?.status).toBe('failed');
          } else expect(persisted).toBeNull();
          expect(modelCalls).toBe(failureAt === 'input' ? 0 : 1);
          expect(network).not.toHaveBeenCalled();
        } finally {
          cleanup?.();
          for (const mastra of instances.reverse()) await mastra.shutdown();
          network.mockRestore();
        }
      },
      15_000,
    );
  });
});
