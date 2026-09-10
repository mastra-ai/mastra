import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../../memory/src';
import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent, isDurableAgent } from '../../agent/durable';
import { TripWire } from '../../agent/trip-wire';
import { Mastra } from '../../mastra';
import { InMemoryDB, InMemoryMemory, InMemoryStore, MastraCompositeStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import type { AgentControllerEvent } from '../types';

describe.each(['ordinary', 'durable', 'evented'] as const)('Session saved-output failure (%s)', execution => {
  const durable = execution !== 'ordinary';
  it.each([
    'none',
    'once',
    'always',
    'processor-error',
    'processor-tripwire',
    'processor-tripwire-retry',
    ...(durable ? (['queue-none', 'queue-always'] as const) : []),
  ] as const)(
    'does not claim completion with an unsaved answer: %s',
    async fault => {
      const network = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('Network is forbidden in this test');
      });
      const answer = 'The final answer must be saved or its failure exposed.';
      let failedWrites = 0;
      let modelCalls = 0;
      let outputChecks = 0;
      let faultActive = true;
      class FailingMemoryStorage extends InMemoryMemory {
        override async saveMessages(args: Parameters<InMemoryMemory['saveMessages']>[0]) {
          if (
            faultActive &&
            args.messages.some(message => message.role === 'assistant') &&
            (fault === 'always' || fault === 'queue-always' || (fault === 'once' && failedWrites === 0))
          ) {
            failedWrites++;
            throw new Error('Assistant message save failed');
          }
          return super.saveMessages(args);
        }
      }
      const storage = new MastraCompositeStore({
        id: randomUUID(),
        default: new InMemoryStore(),
        domains: { memory: new FailingMemoryStorage({ db: new InMemoryDB() }) },
      });
      const base = new Agent({
        id: 'save-failure-agent',
        name: 'Save failure',
        instructions: 'Answer once.',
        maxRetries: 0,
        memory: new Memory({
          storage,
          options: {
            generateTitle: false,
            observationalMemory: false,
            ...(fault.startsWith('queue-') ? { lastMessages: false as const } : {}),
          },
        }),
        outputProcessors: fault.startsWith('processor-')
          ? [
              {
                id: 'reject-final-output',
                processOutputResult({ abort, messageList }) {
                  outputChecks++;
                  if (!faultActive) return messageList;
                  if (fault.startsWith('processor-tripwire'))
                    abort('Output guard rejected the answer', {
                      retry: fault === 'processor-tripwire-retry',
                      metadata: { policy: 'test-output-policy', rejected: true },
                    });
                  throw new Error('Output processor failed');
                },
              },
            ]
          : undefined,
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            modelCalls++;
            return {
              stream: new ReadableStream({
                start(stream) {
                  stream.enqueue({ type: 'stream-start', warnings: [] });
                  stream.enqueue({ type: 'text-start', id: 'answer' });
                  stream.enqueue({ type: 'text-delta', id: 'answer', delta: answer });
                  stream.enqueue({ type: 'text-end', id: 'answer' });
                  stream.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  stream.close();
                },
              }),
            };
          },
        }),
      });
      const candidate: unknown =
        execution === 'evented'
          ? createEventedAgent({ agent: base })
          : durable
            ? createDurableAgent({ agent: base })
            : base;
      if (!(candidate instanceof Agent)) throw new TypeError('Expected a native Agent');
      const controller = new AgentController({
        id: 'save-failure-controller',
        storage,
        modes: [{ id: 'default', name: 'Default', default: true, agent: candidate }],
      });
      const mastra = new Mastra({
        agents: { candidate },
        agentControllers: { controller },
        storage,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      try {
        expect(isDurableAgent(mastra.getAgent('candidate'))).toBe(durable);
        await controller.init();
        const session = await controller.createSession({ resourceId: randomUUID(), threadId: randomUUID() });
        const events: AgentControllerEvent[] = [];
        session.subscribe(event => events.push(event));
        let sendError: unknown;
        await session.sendMessage({ content: 'Give the test answer.' }).catch(error => {
          sendError = error;
        });
        await delay(100);
        const messages = await session.thread.listActiveMessages({ limit: 100 });
        const savedAnswers = messages
          .filter(message => message.role === 'assistant')
          .flatMap(message => message.content.parts)
          .filter(part => part.type === 'text' && part.text === answer);
        expect(modelCalls).toBe(1);
        expect(session.run.isRunning()).toBe(false);
        if (fault === 'once' || fault === 'always' || fault === 'queue-always') expect(failedWrites).toBeGreaterThan(0);
        expect(outputChecks).toBe(fault.startsWith('processor-') ? 1 : 0);
        const ends = events.filter(event => event.type === 'agent_end').map(event => event.reason);
        expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
        if (fault === 'none' || fault === 'queue-none' || savedAnswers.length > 0) {
          expect(savedAnswers).toHaveLength(1);
          expect(ends).toEqual(['complete']);
          expect(sendError).toBeUndefined();
          expect(events.filter(event => event.type === 'error')).toHaveLength(0);
        } else {
          expect(ends).toEqual(['error']);
          expect(Boolean(sendError) || events.some(event => event.type === 'error')).toBe(true);
          expect(events.filter(event => event.type === 'error')).toHaveLength(1);
          if (fault.startsWith('processor-tripwire')) {
            const failure = events.find(event => event.type === 'error');
            expect(failure?.type).toBe('error');
            if (failure?.type !== 'error') throw new Error('Missing guard error');
            expect(failure.error).toBeInstanceOf(TripWire);
            expect(failure.error).toMatchObject({
              message: 'Output guard rejected the answer',
              processorId: 'reject-final-output',
              options: {
                retry: fault === 'processor-tripwire-retry',
                metadata: { policy: 'test-output-policy', rejected: true },
              },
            });
          }
        }
        // The same session must accept a new turn once the real fault is removed.
        // A terminal failure must not leave a stale stream or replay the old run.
        faultActive = false;
        events.length = 0;
        await session.sendMessage({ content: 'Try a new turn after the fault was removed.' });
        await delay(100);
        expect(modelCalls).toBe(2);
        expect(session.run.isRunning()).toBe(false);
        expect(events.filter(event => event.type === 'agent_start')).toHaveLength(1);
        expect(events.filter(event => event.type === 'agent_end').map(event => event.reason)).toEqual(['complete']);
        expect(events.filter(event => event.type === 'error')).toHaveLength(0);
        const newMessages = await session.thread.listActiveMessages({ limit: 100 });
        expect(
          newMessages.some(
            message =>
              message.role === 'assistant' &&
              !messages.some(old => old.id === message.id) &&
              message.content.parts.some(part => part.type === 'text' && part.text === answer),
          ),
        ).toBe(true);
        expect(network).not.toHaveBeenCalled();
      } finally {
        await controller.destroy();
        await mastra.shutdown();
        network.mockRestore();
      }
    },
    15_000,
  );
});
