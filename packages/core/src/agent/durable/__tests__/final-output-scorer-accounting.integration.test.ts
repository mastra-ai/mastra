import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../../../memory/src';
import { createScorer } from '../../../evals';
import type { ScoringHookInput } from '../../../evals';
import { AvailableHooks, deregisterHook, registerHook } from '../../../hooks';
import { Mastra } from '../../../mastra';
import { InMemoryDB, InMemoryMemory, InMemoryStore, MastraCompositeStore } from '../../../storage';
import { MastraLanguageModelV2Mock } from '../../../test-utils/llm-mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

describe.each(['ordinary', 'durable', 'evented'] as const)('final-output scorer accounting (%s)', execution => {
  it.each(['healthy', 'save-failure', 'tripwire', 'redaction', 'redaction-inplace'] as const)(
    'records scoring coverage separately from the run outcome: %s',
    async outcome => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
      const redaction = outcome === 'redaction' || outcome === 'redaction-inplace';
      const runId = randomUUID();
      const scorerId = randomUUID();
      const payloads: ScoringHookInput[] = [];
      const onScorer = (payload: ScoringHookInput) => {
        if (payload.scorer?.id === scorerId) payloads.push(payload);
      };
      registerHook(AvailableHooks.ON_SCORER_RUN, onScorer);
      let modelCalls = 0;
      let failedWrites = 0;
      const score = vi.fn(() => 1);
      // This value proves dispatch and storage only. It is not a quality judgment.
      const scorer = createScorer({
        id: scorerId,
        name: scorerId,
        description: 'Diagnostic dispatch only',
      }).generateScore(score);
      class FailingMemory extends InMemoryMemory {
        override async saveMessages(args: Parameters<InMemoryMemory['saveMessages']>[0]) {
          if (outcome === 'save-failure' && args.messages.some(message => message.role === 'assistant')) {
            failedWrites++;
            throw new Error('Diagnostic save failed');
          }
          return super.saveMessages(args);
        }
      }
      const storage = new MastraCompositeStore({
        id: runId,
        default: new InMemoryStore(),
        domains: { memory: new FailingMemory({ db: new InMemoryDB() }) },
      });
      const base = new Agent({
        id: randomUUID(),
        name: 'Scorer accounting',
        instructions: 'Answer once.',
        memory: new Memory({ storage, options: { generateTitle: false, observationalMemory: false } }),
        scorers: { diagnostic: { scorer, sampling: { type: 'ratio', rate: 1 } } },
        outputProcessors: [
          {
            id: 'final-check',
            processOutputResult({ messages, messageList, abort }) {
              if (outcome === 'tripwire') abort('Diagnostic final rejection', { retry: false });
              if (outcome === 'redaction-inplace') {
                for (const message of messages)
                  if (message.role === 'assistant') message.content.parts = [{ type: 'text', text: 'Approved text.' }];
                return messageList;
              }
              return outcome === 'redaction'
                ? messages.map(message => ({
                    ...message,
                    content: {
                      ...message.content,
                      parts: [{ type: 'text' as const, text: 'Approved text.' }],
                    },
                  }))
                : messages;
            },
          },
        ],
        model: new MastraLanguageModelV2Mock({
          doGenerate: async () => {
            modelCalls++;
            return {
              content: [{ type: 'text', text: 'Original text.' }],
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            };
          },
          doStream: async () => {
            modelCalls++;
            return {
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'stream-start', warnings: [] });
                  controller.enqueue({ type: 'text-start', id: 'answer' });
                  controller.enqueue({ type: 'text-delta', id: 'answer', delta: 'Original text.' });
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
        execution === 'ordinary'
          ? base
          : execution === 'durable'
            ? createDurableAgent({ agent: base })
            : createEventedAgent({ agent: base });
      const mastra = new Mastra({
        agents: { agent },
        scorers: { diagnostic: scorer },
        storage,
        logger: false,
        workers: false,
        scheduler: { enabled: false },
        recovery: { durableAgents: 'off' },
      });
      try {
        let failure: unknown;
        const result = await agent
          .generate('Give the answer.', {
            runId,
            savePerStep: execution === 'ordinary' && outcome === 'redaction-inplace',
            memory: { thread: runId, resource: runId },
          })
          .catch(error => {
            failure = error;
          });
        const scores = await storage.getStore('scores');
        if (!scores) throw new Error('Missing native score store');
        const readScores = () => scores.listScoresByRunId({ runId, pagination: { page: 0, perPage: 100 } });
        const success = outcome === 'healthy' || redaction;
        if (success)
          await vi.waitFor(async () => expect((await readScores()).scores).toHaveLength(1), { timeout: 3000 });
        else await delay(150);
        const rows = (await readScores()).scores;
        expect(modelCalls).toBe(1);
        if (outcome === 'save-failure') {
          expect(failedWrites).toBeGreaterThan(0);
          expect(Boolean(failure) || result?.finishReason === 'error').toBe(true);
        } else if (outcome === 'tripwire') expect(result?.tripwire?.reason).toBe('Diagnostic final rejection');
        else expect(result?.finishReason).toBe('stop');
        expect(score).toHaveBeenCalledTimes(success ? 1 : 0);
        expect(payloads).toHaveLength(success ? 1 : 0);
        expect(rows).toHaveLength(success ? 1 : 0);
        if (success) {
          expect(payloads[0].runId).toBe(runId);
          expect(Array.isArray(payloads[0].output)).toBe(true);
          expect(JSON.stringify(payloads[0].output)).toContain(redaction ? 'Approved text.' : 'Original text.');
          if (redaction) console.info('REDACTION_SCORER_PAYLOAD', JSON.stringify(payloads[0].output));
          if (redaction) expect(JSON.stringify(payloads[0].output)).not.toContain('Original text.');
          expect(payloads[0].output).not.toHaveProperty('finishReason');
        }
        const accounting = {
          execution,
          outcome,
          runId,
          modelCalls,
          savePerStep: execution === 'ordinary' && outcome === 'redaction-inplace',
          failedWrites,
          terminal: failure ? 'threw' : result?.tripwire ? 'tripwire' : result?.finishReason,
          scorerInvocations: score.mock.calls.length,
          scoreRows: rows.length,
          scoringCoverage: rows.length ? 'diagnostic-only' : 'missing-not-success',
          failure: failure instanceof Error ? { name: failure.name, message: failure.message } : undefined,
          tripwire: result?.tripwire,
          scorerPayloads: payloads.map(payload => ({
            runId: payload.runId,
            input: payload.input,
            output: payload.output,
          })),
          storedScores: rows,
          storedMessages: (await (await storage.getStore('memory'))?.listMessages({ threadId: runId, perPage: 100 }))
            ?.messages,
        };
        if (redaction) {
          expect(result?.text).toBe('Approved text.');
          expect(JSON.stringify(accounting.storedMessages)).not.toContain('Original text.');
          expect(JSON.stringify(rows)).not.toContain('Original text.');
        }
        if (process.env.MASTRA_SCORER_PROOF_FILE) {
          await appendFile(process.env.MASTRA_SCORER_PROOF_FILE, JSON.stringify(accounting) + '\n');
        }
        expect(network).not.toHaveBeenCalled();
      } finally {
        await mastra.shutdown();
        deregisterHook(AvailableHooks.ON_SCORER_RUN, onScorer);
        network.mockRestore();
      }
    },
    15_000,
  );
});
