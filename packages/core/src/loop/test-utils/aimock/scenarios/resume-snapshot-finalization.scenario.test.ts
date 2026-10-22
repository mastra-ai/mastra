import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../memory/src';
import type { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

// #27445: a storage reader must still find the resumed run until its final reply is persisted.
describeForAllEngines('Resumed run snapshot finalization', engine => {
  const getMock = useLoopScenarioAimock();
  const answer = 'Your refund has been completed.';
  const threadId = 'refund-thread';
  const resourceId = 'refund-customer';

  for (const memoryKind of ['history', 'observational'] as const) {
    for (const kind of ['approval', 'suspend'] as const) {
      for (const rejectSave of [false, true]) {
        it(`${memoryKind} memory, ${kind}: retains snapshots during final save and ${rejectSave ? 'reports a rejected save' : 'cleans up after persistence'} (#27445)`, async () => {
          const memory =
            memoryKind === 'history'
              ? new MockMemory()
              : new Memory({
                  storage: new InMemoryStore(),
                  options: {
                    generateTitle: false,
                    semanticRecall: false,
                    observationalMemory: {
                      enabled: true,
                      scope: 'thread',
                      observation: {
                        model: createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` }).chat(
                          'gpt-4o-mini',
                        ),
                        messageTokens: 100_000,
                        bufferTokens: false,
                      },
                      reflection: { observationTokens: 100_000 },
                    },
                  },
                });
          const refund = createTool({
            id: 'refund',
            description: 'Refund the order.',
            inputSchema: z.object({}),
            requireApproval: kind === 'approval',
            suspendSchema: z.object({ question: z.string() }),
            resumeSchema: z.object({ approved: z.boolean() }),
            execute: async (_input, context) => {
              if (kind === 'suspend' && !context?.agent?.resumeData) {
                return await context?.agent?.suspend({ question: 'Refund?' });
              }
              return { receipt: 'REFUND_RECEIPT_4821' };
            },
          });
          const shared = await createSharedAgent(getMock(), { engine, tools: { refund }, memory });
          const { output, chunks } = await runLoopScenario({
            engine,
            llm: getMock(),
            sharedAgent: shared,
            prompt: 'Refund my order',
            memory,
            memoryOptions: { observationalMemory: memoryKind === 'observational' },
            threadId,
            resourceId,
            stopWhen: stepCountIs(3),
            collectChunks: true,
            fixtures: llm => {
              llm.on(
                { endpoint: 'chat', hasToolResult: false },
                {
                  toolCalls: [{ id: 'refund-call', name: 'refund', arguments: {} }],
                },
              );
              llm.on({ endpoint: 'chat', hasToolResult: true }, { content: answer });
            },
          });
          expect(
            chunks?.some(chunk => chunk.type === (kind === 'approval' ? 'tool-call-approval' : 'tool-call-suspended')),
          ).toBe(true);
          const mastra: Mastra = shared.mastra;
          const workflows = await mastra.getStorage()?.getStore('workflows');
          if (!workflows) throw new Error('Missing workflow store');
          const workflowPrefix = engine === 'inngest' ? 'inngest:' : '';
          const outerName = isDurableEngineVariant(engine) ? `${workflowPrefix}durable-agentic-loop` : 'agentic-loop';
          const nestedName = isDurableEngineVariant(engine)
            ? `${workflowPrefix}durable-agentic-execution`
            : 'executionWorkflow';
          const getSnapshot = () => workflows.loadWorkflowSnapshot({ workflowName: outerName, runId: output.runId });
          const getNestedSnapshot = () =>
            workflows.loadWorkflowSnapshot({ workflowName: nestedName, runId: output.runId });
          expect(await getSnapshot()).not.toBeNull();
          // Evented runs do not persist a separate child workflow row in this scenario.
          if (engine !== 'evented') expect(await getNestedSnapshot()).not.toBeNull();

          const store = await memory.storage.getStore('memory');
          if (!store) throw new Error('Missing memory store');
          const saveMessages = store.saveMessages.bind(store);
          const saving = deferred();
          const release = deferred();
          let intercepted = false;
          store.saveMessages = async args => {
            if (JSON.stringify(args.messages).includes(answer)) {
              intercepted = true;
              saving.resolve();
              await release.promise;
              if (rejectSave) throw new Error('final reply storage unavailable');
            }
            return saveMessages(args);
          };
          const received: ChunkType[] = [];
          let streamError: unknown;
          let finished = false;
          let completed = false;
          const resumed = await shared.agent.resumeStream(
            { approved: true },
            {
              runId: output.runId,
              toolCallId: 'refund-call',
              memory: {
                thread: threadId,
                resource: resourceId,
                options: { observationalMemory: memoryKind === 'observational' },
              },
              onFinish: () => {
                completed = true;
              },
            },
          );
          const drain = (async () => {
            try {
              for await (const chunk of resumed.fullStream) received.push(chunk);
            } catch (error) {
              streamError = error;
            } finally {
              finished = true;
            }
          })();
          try {
            await Promise.race([
              saving.promise,
              drain.then(() => {
                if (!intercepted) throw new Error('Stream ended without saving final reply');
              }),
            ]);
            expect(finished).toBe(false);
            expect(completed).toBe(false);
            expect(await getSnapshot(), 'run vanished while its final save was pending').not.toBeNull();
            if (engine !== 'evented') {
              expect(await getNestedSnapshot(), 'nested run vanished while its final save was pending').not.toBeNull();
            }
            const before = await memory.recall({ threadId, resourceId });
            expect(JSON.stringify(before.messages)).not.toContain(answer);
          } finally {
            release.resolve();
            await drain;
            store.saveMessages = saveMessages;
          }
          if (rejectSave) {
            expect(received.some(chunk => chunk.type === 'finish')).toBe(false);
            const errorChunk = received.find(chunk => chunk.type === 'error');
            expect(String(streamError ?? errorChunk?.payload.error)).toContain('final reply storage unavailable');
            expect(completed).toBe(false);
            expect(JSON.stringify((await memory.recall({ threadId, resourceId })).messages)).not.toContain(answer);
          } else {
            expect(streamError).toBeUndefined();
            expect(completed).toBe(true);
            expect(received.some(chunk => chunk.type === 'finish')).toBe(true);
            const saved = JSON.stringify((await memory.recall({ threadId, resourceId })).messages);
            expect(saved).toContain(answer);
            expect(saved).toContain('REFUND_RECEIPT_4821');
            await expect.poll(getSnapshot).toBeNull();
            await expect.poll(getNestedSnapshot).toBeNull();
          }
        });
      }
    }
  }
});
