import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../memory/src';
import { Agent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { storeRunsInV2 } from '../../../../agent/durable/__tests__/storage-version';
import { DurableStepIds } from '../../../../agent/durable/constants';
import type { IFGAProvider } from '../../../../auth';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { Mastra } from '../../../../mastra';
import type { OutputProcessor } from '../../../../processors';
import { MessageHistory } from '../../../../processors/memory/message-history';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

// Explicit MessageHistory must obey the run's persistence policy without a Memory instance. (#29772)
describeForAllEngines('explicit history uses request-context memory safely', engine => {
  const getMock = useLoopScenarioAimock();

  // A fresh durable worker must resolve context-dependent processors before resuming (#29772).
  if (engine === 'durable' || engine === 'evented') {
    for (const lifecycle of ['recover', 'observe'] as const) {
      it(`cold ${lifecycle} retains explicit history context without a Memory instance`, async () => {
        const store = new InMemoryStore();
        const cache = new InMemoryServerCache();
        const pubsub = new EventEmitterPubSub();
        const memoryContext = { thread: { id: `cold-${lifecycle}-${engine}` }, resourceId: 'history-resource' };
        const createWorker = async (workerStore: InMemoryStore, contexts: unknown[]) => {
          const storage = (await workerStore.getStore('memory'))!;
          const agent = new Agent({
            id: 'recover-history',
            name: 'Recover history',
            instructions: 'Answer the question.',
            model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat('gpt-4o-mini'),
            outputProcessors: ({ requestContext }) => {
              contexts.push(requestContext.get('MastraMemory'));
              return requestContext.get('MastraMemory') ? [new MessageHistory({ storage })] : [];
            },
          });
          const wrapped = storeRunsInV2(
            engine === 'evented' ? createEventedAgent({ agent }) : createDurableAgent({ agent }),
            false,
          );
          const mastra = new Mastra({
            agents: { history: wrapped },
            storage: workerStore,
            cache: workerStore === store ? cache : new InMemoryServerCache(),
            pubsub: workerStore === store ? pubsub : new EventEmitterPubSub(),
            logger: false,
            recovery: { durableAgents: 'auto' },
          });
          return { agent: mastra.getAgent('history'), mastra, storage };
        };
        const workflows = (await store.getStore('workflows'))!;
        type SnapshotRow = Parameters<typeof workflows.persistWorkflowSnapshot>[0];
        const rows = new Map<string, SnapshotRow>();
        let checkpoint: SnapshotRow[] | undefined;
        const persist = workflows.persistWorkflowSnapshot.bind(workflows);
        workflows.persistWorkflowSnapshot = async args => {
          await persist(args);
          rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
          if (
            args.workflowName === DurableStepIds.AGENTIC_EXECUTION &&
            args.snapshot.status === 'pending' &&
            !checkpoint
          ) {
            checkpoint = structuredClone([...rows.values()]);
          }
        };
        getMock().on({ endpoint: 'chat' }, { content: 'Your order is ready.' });
        const original = await createWorker(store, []);
        const requestContext = new RequestContext();
        requestContext.set('MastraMemory', memoryContext);
        const first = await original.agent.stream('Find my order', { requestContext, runId: crypto.randomUUID() });
        for await (const _chunk of first.fullStream) {
          /* Complete the original so the restored worker has no live execution. */
        }
        await vi.waitFor(async () => {
          expect(
            await workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId: first.runId }),
          ).toBeFalsy();
        });
        expect(checkpoint).toBeDefined();
        const restoredStore = lifecycle === 'recover' ? new InMemoryStore() : store;
        const restoredWorkflows = (await restoredStore.getStore('workflows'))!;
        for (const row of checkpoint!) await restoredWorkflows.persistWorkflowSnapshot(row);
        const contexts: unknown[] = [];
        const replacement = await createWorker(restoredStore, contexts);
        try {
          const result = await replacement.agent[lifecycle](first.runId);
          let text = '';
          for await (const chunk of result.fullStream) {
            if (chunk.type === 'text-delta') text += chunk.payload.text;
          }
          expect(text).toBe('Your order is ready.');
          expect(contexts).toContainEqual(memoryContext);
          await vi.waitFor(async () => {
            const { messages } = await replacement.storage.listMessages({
              threadId: memoryContext.thread.id,
              perPage: false,
            });
            expect(messages.flatMap(message => message.content.parts)).toContainEqual(
              expect.objectContaining({ type: 'text', text: 'Your order is ready.' }),
            );
          });
          result.cleanup();
        } finally {
          first.cleanup();
          await replacement.mastra.shutdown();
          await original.mastra.shutdown();
        }
      });
    }

    for (const contextChange of ['unchanged', 'input-redirect', 'input-read-only'] as const) {
      for (const supplyContext of [false, true]) {
        it(`cold resume retains ${contextChange} history with ${supplyContext ? 'supplied' : 'persisted'} request context`, async () => {
          const store = new InMemoryStore();
          const storage = (await store.getStore('memory'))!;
          const threadId = `cold-history-${engine}-${supplyContext}-${contextChange}`;
          const resourceId = 'history-resource';
          const memoryContext = {
            thread: { id: threadId },
            resourceId,
            ...(contextChange === 'input-read-only' ? { memoryConfig: { readOnly: true } } : {}),
          };
          const seen: unknown[] = [];
          const createWorker = () => {
            const agent = new Agent({
              id: 'cold-history',
              name: 'Cold history',
              instructions: 'Look up the order.',
              model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat('gpt-4o-mini'),
              tools: {
                lookup: createTool({
                  id: 'lookup',
                  description: 'Look up an order.',
                  inputSchema: z.object({}),
                  requireApproval: true,
                  execute: async (_input, context) => {
                    seen.push(context?.requestContext?.get('MastraMemory'));
                    return { order: 'ORDER_29772' };
                  },
                }),
              },
              inputProcessors: [
                {
                  id: 'change-history-context',
                  processInput: ({ requestContext, messageList }) => {
                    if (contextChange !== 'unchanged' && !requestContext.get('history-context-applied')) {
                      requestContext.set('MastraMemory', memoryContext);
                      requestContext.set('history-context-applied', true);
                    }
                    return messageList;
                  },
                },
              ],
              outputProcessors: ({ requestContext }) =>
                requestContext.get('MastraMemory') ? [new MessageHistory({ storage })] : [],
            });
            const wrapped = engine === 'evented' ? createEventedAgent({ agent }) : createDurableAgent({ agent });
            const mastra = new Mastra({ agents: { history: wrapped }, storage: store, logger: false });
            return mastra.getAgent('history');
          };
          getMock().on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: {} }],
            },
          );
          getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Your order is ready.' });
          const requestContext = new RequestContext();
          requestContext.set('MastraMemory', {
            thread: { id: contextChange === 'input-redirect' ? `${threadId}-original` : threadId },
            resourceId,
          });
          const first = await createWorker().stream('Find my order', { requestContext, closeOnSuspend: true });
          for await (const _chunk of first.fullStream) {
            /* Drain until suspension is committed. */
          }
          expect((await first.output.getFullOutput()).finishReason).toBe('suspended');
          first.cleanup();
          const resumed = await createWorker().approveToolCall({
            runId: first.runId,
            toolCallId: 'call_lookup',
            ...(supplyContext ? { requestContext: new RequestContext() } : {}),
          });
          let resumedText = '';
          for await (const chunk of resumed.fullStream) {
            if (chunk.type === 'text-delta') resumedText += chunk.payload.text;
          }
          expect(resumedText).toBe('Your order is ready.');
          expect(seen).toEqual([expect.objectContaining(memoryContext)]);
          const { messages } = await storage.listMessages({ threadId, perPage: false });
          if (contextChange === 'input-read-only') {
            expect(messages).toEqual([]);
          } else {
            expect(messages.flatMap(message => message.content.parts)).toContainEqual(
              expect.objectContaining({ type: 'text', text: 'Your order is ready.' }),
            );
          }
        });
      }
    }
  }

  for (const terminal of ['finish', 'deadline'] as const) {
    for (const variant of [
      'allowed',
      'denied',
      'read-only',
      'context-read-only',
      'tripwire',
      'undo-failure',
      'missing-resource',
      'redirect-denied',
      'conflicting-threads',
      'conflicting-threads-missing-resource',
      'run-denied',
      'input-redirect',
      'input-read-only',
      'memory-tripwire',
      'memory-redirect-tripwire',
    ] as const) {
      // Inngest does not yet run output processors at the total deadline (#29047).
      it.skipIf(terminal === 'deadline' && engine === 'inngest')(
        `${terminal}: ${variant} history persistence`,
        async () => {
          const store = new InMemoryStore();
          const storage = (await store.getStore('memory'))!;
          const memory =
            variant === 'memory-redirect-tripwire'
              ? new Memory({ storage: store })
              : variant === 'memory-tripwire'
                ? new Memory({ storage: new InMemoryStore() })
                : undefined;
          const threadId = `history-${engine}-${terminal}-${variant}`;
          const runThreadId = `${threadId}-run`;
          const resourceId = 'history-resource';
          const conflictingThreads =
            variant === 'conflicting-threads' || variant === 'conflicting-threads-missing-resource';
          const missingResource = variant === 'missing-resource' || variant === 'conflicting-threads-missing-resource';
          const runResourceId = conflictingThreads ? 'run-resource' : resourceId;
          const authorizations: { threadId: string; resourceId: unknown }[] = [];
          const events: string[] = [];
          const saveMessages = storage.saveMessages.bind(storage);
          storage.saveMessages = async args => {
            if (
              variant === 'memory-redirect-tripwire' &&
              args.messages.every(message => message.threadId === runThreadId && message.resourceId === resourceId)
            ) {
              return saveMessages(args);
            }
            events.push('save');
            expect(
              args.messages.every(message => message.threadId === threadId && message.resourceId === resourceId),
            ).toBe(true);
            return saveMessages(args);
          };
          const requestContext = new RequestContext();
          requestContext.set('user', { id: 'reader' });
          requestContext.set('MastraMemory', {
            thread: { id: variant === 'input-redirect' ? `${threadId}-original` : threadId },
            ...(missingResource ? {} : { resourceId }),
            ...(variant === 'context-read-only' ? { memoryConfig: { readOnly: true } } : {}),
          });
          const deniedThread =
            variant === 'redirect-denied' ? `${threadId}-redirect` : variant === 'run-denied' ? runThreadId : threadId;
          const denied = variant === 'denied' || variant === 'redirect-denied' || variant === 'run-denied';
          const fga: IFGAProvider = {
            check: async () => true,
            filterAccessible: async (_user, resources) => resources,
            require: async (_user, { permission, resource, context }) => {
              if (String(permission) !== 'memory:write') return;
              events.push(`authorize:${resource.id}`);
              authorizations.push({ threadId: resource.id, resourceId: context?.resourceId });
              if (conflictingThreads && resource.id === runThreadId && context?.resourceId !== runResourceId) {
                throw new Error('Run thread authorized with the wrong resource');
              }
              if (denied && resource.id === deniedThread) throw new Error('History write denied');
            },
          };
          const processors: OutputProcessor[] = [];
          if (variant === 'redirect-denied' || variant === 'memory-redirect-tripwire')
            processors.push({
              id: 'redirect-history',
              processOutputResult: ({ messageList, requestContext }) => {
                requestContext.set('MastraMemory', {
                  thread: { id: variant === 'memory-redirect-tripwire' ? threadId : deniedThread },
                  resourceId,
                });
                return messageList;
              },
            });
          if (variant === 'tripwire')
            processors.push({
              id: 'stamp-response',
              processOutputResult: ({ messageList }) => {
                for (const message of messageList.get.response.db()) {
                  message.threadId = threadId;
                  message.resourceId = resourceId;
                }
                return messageList;
              },
            });
          if (missingResource)
            processors.push({
              id: 'retain-message-resource',
              processOutputResult: ({ messageList, requestContext }) => {
                requestContext.set('MastraMemory', { thread: { id: threadId } });
                for (const message of messageList.get.all.db()) message.resourceId = resourceId;
                return messageList;
              },
            });
          processors.push(new MessageHistory({ storage }));
          const failingStorage =
            variant === 'undo-failure' ? (await new InMemoryStore().getStore('memory'))! : undefined;
          if (failingStorage) {
            failingStorage.deleteMessages = async () => {
              throw new Error('Storage unavailable during rollback');
            };
            processors.push(new MessageHistory({ storage: failingStorage }));
          }
          if (
            variant === 'tripwire' ||
            variant === 'undo-failure' ||
            variant === 'memory-tripwire' ||
            variant === 'memory-redirect-tripwire'
          )
            processors.push({
              id: 'block-response',
              processOutputResult: ({ abort }) => abort('Blocked response'),
            });
          const hang = Promise.withResolvers<unknown>();
          try {
            await runLoopScenario({
              engine,
              llm: getMock(),
              prompt: 'Hello',
              requestContext,
              server: { fga },
              agentOutputProcessors: processors,
              inputProcessors:
                variant === 'input-redirect' || variant === 'input-read-only'
                  ? [
                      {
                        id: 'update-memory-context',
                        processInput: ({ messageList, requestContext }) => {
                          requestContext.set('MastraMemory', {
                            thread: { id: threadId },
                            resourceId,
                            ...(variant === 'input-read-only' ? { memoryConfig: { readOnly: true } } : {}),
                          });
                          return messageList;
                        },
                      },
                    ]
                  : undefined,
              memory,
              threadId: memory
                ? variant === 'memory-redirect-tripwire'
                  ? runThreadId
                  : threadId
                : conflictingThreads || variant === 'run-denied'
                  ? runThreadId
                  : undefined,
              resourceId: memory || conflictingThreads || variant === 'run-denied' ? runResourceId : undefined,
              defaultOptions: {
                memory: {
                  ...(conflictingThreads || variant === 'run-denied'
                    ? { thread: runThreadId, resource: runResourceId }
                    : {}),
                  ...(variant === 'read-only' ? { options: { readOnly: true } } : {}),
                },
              },
              modelSettings: terminal === 'deadline' ? { timeout: { totalMs: 800 } } : undefined,
              expectStreamError: denied || terminal === 'deadline',
              collectChunks: true,
              tools:
                terminal === 'deadline'
                  ? {
                      hanging: createTool({
                        id: 'hanging',
                        description: 'Wait for completion.',
                        inputSchema: z.object({}),
                        execute: async () => hang.promise,
                      }),
                    }
                  : undefined,
              fixtures: llm => {
                llm.on(
                  { endpoint: 'chat' },
                  terminal === 'deadline'
                    ? { toolCalls: [{ id: 'call_hang', name: 'hanging', arguments: {} }] }
                    : { content: 'Private reply' },
                );
              },
            });
            const { messages } = await storage.listMessages({ threadId, perPage: false });
            const redirected = await storage.listMessages({ threadId: deniedThread, perPage: false });
            const runMessages = await storage.listMessages({ threadId: runThreadId, perPage: false });
            if (variant === 'memory-redirect-tripwire') {
              expect(runMessages.messages.some(message => message.role === 'assistant')).toBe(false);
            } else {
              expect(runMessages.messages).toEqual([]);
            }
            if (
              variant === 'allowed' ||
              conflictingThreads ||
              variant === 'missing-resource' ||
              variant === 'input-redirect'
            ) {
              expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
              expect(messages.every(message => message.resourceId === resourceId)).toBe(true);
              expect(events.indexOf(`authorize:${threadId}`)).toBeGreaterThanOrEqual(0);
              expect(events.indexOf(`authorize:${threadId}`)).toBeLessThan(events.indexOf('save'));
              if (conflictingThreads) {
                expect(authorizations).toContainEqual({
                  threadId,
                  resourceId: missingResource ? undefined : resourceId,
                });
                expect(authorizations).toContainEqual({ threadId: runThreadId, resourceId: runResourceId });
                expect(events.indexOf(`authorize:${runThreadId}`)).toBeGreaterThanOrEqual(0);
                expect(events.indexOf(`authorize:${runThreadId}`)).toBeLessThan(events.indexOf('save'));
              }
            } else if (
              variant === 'tripwire' ||
              variant === 'undo-failure' ||
              variant === 'memory-tripwire' ||
              variant === 'memory-redirect-tripwire'
            ) {
              expect(events).toContain('save');
              expect(messages.map(message => message.role)).toEqual(['user']);
              if (memory) {
                const memoryStorage = (await memory.storage.getStore('memory'))!;
                const remaining = await memoryStorage.listMessages({ threadId, perPage: false });
                expect(remaining.messages.some(message => message.role === 'assistant')).toBe(false);
              }
              if (failingStorage) {
                const remaining = await failingStorage.listMessages({ threadId, perPage: false });
                expect(remaining.messages.map(message => message.role)).toEqual(['user', 'assistant']);
              }
            } else {
              expect(messages).toEqual([]);
              expect(redirected.messages).toEqual([]);
              expect(events).not.toContain('save');
              if (denied) expect(events).toContain(`authorize:${deniedThread}`);
            }
          } finally {
            hang.resolve({});
          }
        },
        15_000,
      );
    }
  }
});
