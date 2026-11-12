import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { IFGAProvider } from '../../../../auth';
import type { OutputProcessor } from '../../../../processors';
import { MessageHistory } from '../../../../processors/memory/message-history';
import { RequestContext } from '../../../../request-context';
import { InMemoryStore } from '../../../../storage';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

// Explicit MessageHistory must obey the run's persistence policy without a Memory instance. (#29772)
describeForAllEngines('explicit history uses request-context memory safely', engine => {
  const getMock = useLoopScenarioAimock();

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
      'run-denied',
    ] as const) {
      // Inngest does not yet run output processors at the total deadline (#29047).
      it.skipIf(terminal === 'deadline' && engine === 'inngest')(
        `${terminal}: ${variant} history persistence`,
        async () => {
          const store = new InMemoryStore();
          const storage = (await store.getStore('memory'))!;
          const threadId = `history-${engine}-${terminal}-${variant}`;
          const runThreadId = `${threadId}-run`;
          const resourceId = 'history-resource';
          const events: string[] = [];
          const saveMessages = storage.saveMessages.bind(storage);
          storage.saveMessages = async args => {
            events.push('save');
            expect(
              args.messages.every(message => message.threadId === threadId && message.resourceId === resourceId),
            ).toBe(true);
            return saveMessages(args);
          };
          const requestContext = new RequestContext();
          requestContext.set('user', { id: 'reader' });
          requestContext.set('MastraMemory', {
            thread: { id: threadId },
            ...(variant === 'missing-resource' ? {} : { resourceId }),
            ...(variant === 'context-read-only' ? { memoryConfig: { readOnly: true } } : {}),
          });
          const deniedThread =
            variant === 'redirect-denied' ? `${threadId}-redirect` : variant === 'run-denied' ? runThreadId : threadId;
          const denied = variant === 'denied' || variant === 'redirect-denied' || variant === 'run-denied';
          const fga: IFGAProvider = {
            check: async () => true,
            filterAccessible: async (_user, resources) => resources,
            require: async (_user, { permission, resource }) => {
              if (String(permission) !== 'memory:write') return;
              events.push(`authorize:${resource.id}`);
              if (denied && resource.id === deniedThread) throw new Error('History write denied');
            },
          };
          const processors: OutputProcessor[] = [];
          if (variant === 'redirect-denied')
            processors.push({
              id: 'redirect-history',
              processOutputResult: ({ messageList, requestContext }) => {
                requestContext.set('MastraMemory', { thread: { id: deniedThread }, resourceId });
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
          if (variant === 'missing-resource')
            processors.push({
              id: 'retain-message-resource',
              processOutputResult: ({ messageList }) => {
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
          if (variant === 'tripwire' || variant === 'undo-failure')
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
              threadId: variant === 'conflicting-threads' || variant === 'run-denied' ? runThreadId : undefined,
              resourceId: variant === 'conflicting-threads' || variant === 'run-denied' ? resourceId : undefined,
              defaultOptions: {
                memory: {
                  ...(variant === 'conflicting-threads' || variant === 'run-denied'
                    ? { thread: runThreadId, resource: resourceId }
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
            expect(runMessages.messages).toEqual([]);
            if (variant === 'allowed' || variant === 'conflicting-threads' || variant === 'missing-resource') {
              expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
              expect(messages.every(message => message.resourceId === resourceId)).toBe(true);
              expect(events.indexOf(`authorize:${threadId}`)).toBeGreaterThanOrEqual(0);
              expect(events.indexOf(`authorize:${threadId}`)).toBeLessThan(events.indexOf('save'));
              if (variant === 'conflicting-threads') {
                expect(events.indexOf(`authorize:${runThreadId}`)).toBeGreaterThanOrEqual(0);
                expect(events.indexOf(`authorize:${runThreadId}`)).toBeLessThan(events.indexOf('save'));
              }
            } else if (variant === 'tripwire' || variant === 'undo-failure') {
              expect(events).toContain('save');
              expect(messages.map(message => message.role)).toEqual(['user']);
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
