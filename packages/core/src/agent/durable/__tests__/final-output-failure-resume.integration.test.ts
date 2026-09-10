import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../../../memory/src';
import { Mastra } from '../../../mastra';
import { InMemoryDB, InMemoryMemory, InMemoryStore, MastraCompositeStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

describe.each(['durable', 'evented'] as const)('final output after %s resume', execution => {
  describe.each(['warm', 'rehydrated'] as const)('%s registry', registry => {
    it.each(['none', 'save', 'processor', 'tripwire', 'redaction', 'empty'] as const)(
      'preserves the real terminal outcome: %s',
      async fault => {
        const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
        const id = randomUUID();
        const answer = 'The resumed answer.';
        let modelCalls = 0;
        let toolCalls = 0;
        let outputChecks = 0;
        let failedWrites = 0;
        class FailingMemory extends InMemoryMemory {
          override async saveMessages(args: Parameters<InMemoryMemory['saveMessages']>[0]) {
            if (
              fault === 'save' &&
              args.messages.some(
                message =>
                  message.role === 'assistant' &&
                  message.content.parts.some(part => part.type === 'text' && part.text === answer),
              )
            ) {
              failedWrites++;
              throw new Error('Resumed answer save failed');
            }
            return super.saveMessages(args);
          }
        }
        const storage = new MastraCompositeStore({
          id,
          default: new InMemoryStore(),
          domains: { memory: new FailingMemory({ db: new InMemoryDB() }) },
        });
        const instances: Mastra[] = [];
        const makeAgent = () => {
          const base = new Agent({
            id,
            name: 'Resumed final output',
            instructions: 'Get approval, then answer.',
            memory: new Memory({ storage, options: { generateTitle: false, observationalMemory: false } }),
            tools: {
              localAction: createTool({
                id: 'localAction',
                description: 'Local action',
                inputSchema: z.object({}),
                requireApproval: true,
                execute: async () => {
                  toolCalls++;
                  return { ok: true };
                },
              }),
            },
            outputProcessors: [
              {
                id: 'resumed-output-check',
                processOutputResult({ abort, messageList, messages }) {
                  outputChecks++;
                  if (fault === 'processor') throw new Error('Resumed output processor failed');
                  if (fault === 'tripwire')
                    abort('Resumed output rejected', {
                      retry: true,
                      metadata: { policy: 'resumed-policy', action: 'reject' },
                    });
                  if (fault === 'empty') return [];
                  if (fault === 'redaction')
                    return messages.map(message =>
                      message.content.parts.some(part => part.type === 'text' && part.text === answer)
                        ? {
                            ...message,
                            content: {
                              ...message.content,
                              content: 'Approved resumed answer.',
                              parts: [{ type: 'text' as const, text: 'Approved resumed answer.' }],
                            },
                          }
                        : message,
                    );
                  return messageList;
                },
              },
            ],
            model: new MastraLanguageModelV2Mock({
              doStream: async () => {
                const step = ++modelCalls;
                if (step > 2) throw new Error('Unexpected repeated model execution');
                return {
                  stream: new ReadableStream({
                    start(controller) {
                      controller.enqueue({ type: 'stream-start', warnings: [] });
                      if (step === 1) {
                        controller.enqueue({
                          type: 'tool-call',
                          toolCallId: 'approved-action',
                          toolName: 'localAction',
                          input: '{}',
                        });
                      } else {
                        controller.enqueue({ type: 'text-start', id: 'answer' });
                        controller.enqueue({ type: 'text-delta', id: 'answer', delta: answer });
                        controller.enqueue({ type: 'text-end', id: 'answer' });
                      }
                      controller.enqueue({
                        type: 'finish',
                        finishReason: step === 1 ? 'tool-calls' : 'stop',
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
            execution === 'evented' ? createEventedAgent({ agent: base }) : createDurableAgent({ agent: base });
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
          return agent;
        };
        let agent = makeAgent();
        try {
          const suspended = await agent.generate('Do the approved task.', { memory: { thread: id, resource: id } });
          expect(suspended.finishReason).toBe('suspended');
          expect(modelCalls).toBe(1);
          expect(toolCalls).toBe(0);
          expect(outputChecks).toBe(0);
          const runId = suspended.runId;
          expect(typeof runId).toBe('string');
          if (!runId) throw new Error('Missing suspended run ID');
          expect(agent.runRegistry.has(runId)).toBe(true);
          if (registry === 'rehydrated') {
            // This proves restoration from actual saved snapshots in one process;
            // a separate-process restart is a distinct public-package proof.
            agent.runRegistry.cleanup(runId);
            agent = makeAgent();
            expect(agent.runRegistry.has(runId)).toBe(false);
          }
          let failure: unknown;
          const result = await agent
            .resumeGenerate(runId, { approved: true }, { toolCallId: 'approved-action' })
            .catch(error => {
              failure = error;
            });
          expect(modelCalls).toBe(2);
          expect(toolCalls).toBe(1);
          expect(outputChecks).toBe(1);
          if (fault === 'tripwire') {
            expect(failure).toBeUndefined();
            expect(result?.tripwire).toEqual({
              reason: 'Resumed output rejected',
              retry: true,
              metadata: { policy: 'resumed-policy', action: 'reject' },
              processorId: 'resumed-output-check',
            });
            expect(result?.finishReason).toBe('other');
            expect(result?.text).toBe('');
          } else if (fault === 'none' || fault === 'redaction' || fault === 'empty') {
            expect(failure).toBeUndefined();
            expect(result?.finishReason).toBe('stop');
            expect(result?.text).toBe(
              fault === 'redaction' ? 'Approved resumed answer.' : fault === 'empty' ? '' : answer,
            );
          } else {
            expect(failure).toBeInstanceOf(Error);
            expect((failure as Error).message).toContain(
              fault === 'save' ? 'Resumed answer save failed' : 'Resumed output processor failed',
            );
            expect(result).toBeUndefined();
          }
          expect(failedWrites > 0).toBe(fault === 'save');
          await vi.waitFor(async () => {
            expect((await agent.listActiveRuns()).runs).toHaveLength(0);
          });
          expect(network).not.toHaveBeenCalled();
        } finally {
          for (const mastra of instances.reverse()) await mastra.shutdown();
          network.mockRestore();
        }
      },
      15_000,
    );
  });
});
