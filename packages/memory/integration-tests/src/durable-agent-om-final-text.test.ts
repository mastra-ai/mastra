/**
 * Port of harness case T86 (observational memory persists the final text reply, GH #25023).
 *
 * With observational memory on, the final text-only assistant reply of a tool-using turn must be
 * persisted. The turn calls `lookupCity` and then `getForecast`; the last step is prose, and it is
 * that prose the memory must keep.
 *
 * Variants:
 *
 * - `default`: observational memory scoped to the thread;
 * - `buffering`: the same, with observation/reflection buffering turned on.
 *
 * The harness marks the cell NOT EXERCISED when the model never calls both tools, or when the last
 * step has no text. This port mirrors that: the assertions only run when the shape was produced.
 * Excluded by the harness: any storage adapter other than LibSQL, the reporter's own processors,
 * and exact prose or row counts.
 *
 * Declared difference: with `buffering`, the observation boundary is a fraction of a token threshold,
 * so the observer may fire at a slightly different point in replay than it did during recording. The
 * recorder then serves that request through its fuzzy fallback instead of an exact hash match. The
 * assertions below (final text persisted and recallable) do not depend on where the boundary landed.
 *
 * Replay is the default: traffic is served from `packages/memory/__recordings__/`. To re-record
 * (needs OPENAI_API_KEY and ANTHROPIC_API_KEY), from `packages/memory/integration-tests`:
 *
 *   LLM_TEST_MODE=record pnpm vitest run src/durable-agent-om-final-text.test.ts
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ENGINES,
  PROVIDERS,
  chunksOfType,
  errorChunks,
  persistedMessages,
  recordProviderRequests,
  streamTurn,
} from './durable-harness-helpers';
import { transformRequest } from './transform-request';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic']);

const RECORDING_NAME = 'memory-integration-tests-src-durable-agent-om-final-text';
const PROMPT = 'What is the weather in Lisbon today?';

/** Text parts only — `messageText` concatenates rendered content with the parts, which
 * double-counts the reply. */
function textParts(message: any) {
  const content = message?.content;
  const parts = content?.parts ?? [];
  const text = Array.isArray(parts)
    ? parts
        .filter((part: any) => part?.type === 'text')
        .map((part: any) => String(part.text ?? ''))
        .join('')
    : '';
  return text || (typeof content?.content === 'string' ? content.content : '');
}

const VARIANTS = {
  default: {},
  buffering: {
    observation: { messageTokens: 200, bufferTokens: 0.2, bufferActivation: 0.8 },
    reflection: { bufferActivation: 0.5 },
  },
} as const;

const lookupCity = createTool({
  id: 'lookupCity',
  description: 'Look up the code for a city.',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ code: `C-${city.slice(0, 3).toUpperCase()}-91` }),
});

const getForecast = createTool({
  id: 'getForecast',
  description: 'Get the forecast for a city code.',
  inputSchema: z.object({ code: z.string() }),
  execute: async () => ({ forecast: 'sunny', highC: 23 }),
});

describe.each(Object.entries(PROVIDERS))('T86 om-final-text — %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    describe.each(Object.entries(VARIANTS))('%s variant', (variant, omConfig) => {
      let mock: ReturnType<typeof createGatewayMock>;
      let recorder: ReturnType<typeof recordProviderRequests>;
      let dbDir: string;
      let storage: LibSQLStore;
      let memory: Memory;

      beforeEach(async () => {
        mock = createGatewayMock({
          name: `${RECORDING_NAME}-${provider}-${engine}-${variant}`,
          exactMatch: true,
          transformRequest,
        });
        mock.start();
        recorder = recordProviderRequests();
        dbDir = await mkdtemp(join(tmpdir(), `t86-${provider}-${engine}-${variant}-`));
        storage = new LibSQLStore({ id: randomUUID(), url: `file:${join(dbDir, 'memory.db')}` });
        memory = new Memory({
          storage,
          options: {
            lastMessages: 40,
            semanticRecall: false,
            generateTitle: false,
            workingMemory: { enabled: false },
            observationalMemory: { enabled: true, model, scope: 'thread', ...omConfig },
          } as any,
        });
      });

      afterEach(async () => {
        recorder.restore();
        await mock.saveAndStop();
        await rm(dbDir, { recursive: true, force: true });
      });

      it('persists the final text reply and the user message exactly once', async () => {
        const agent = new Agent({
          id: `t86-agent-${provider}-${engine}-${variant}`,
          name: 't86',
          model,
          memory,
          tools: { lookupCity, getForecast },
          instructions: 'Use the tools when they help, then answer the question.',
        });
        const runner =
          engine === 'plain'
            ? agent
            : engine === 'durable'
              ? createDurableAgent({ agent })
              : createEventedAgent({ agent });
        const mastra = new Mastra({ agents: { t86: runner as any }, storage, logger: false });
        if (engine !== 'plain') {
          expect((runner as any).getWorkflow().engineType).toBe(engine === 'evented' ? 'evented' : 'default');
        }

        const thread = `t86-thread-${provider}-${engine}-${variant}`;
        const resource = `t86-resource-${provider}-${engine}-${variant}`;
        const run = await streamTurn(runner, engine, PROMPT, {
          memory: { thread, resource },
          maxSteps: 6,
        });
        await mastra.stopWorkers?.();
        const { chunks, threw, finishPayloads, errorPayloads } = run;

        expect(threw).toBeNull();
        expect(errorChunks(chunks)).toEqual([]);
        expect(errorPayloads).toEqual([]);
        expect(chunksOfType(chunks, 'finish')).toHaveLength(1);

        // NOT EXERCISED: the model must call both tools and end on prose for this case to apply.
        const calledTools = new Set(
          chunks.filter((c: any) => c.type === 'tool-call').map((c: any) => c.payload?.toolName),
        );
        const lastFinish = finishPayloads.at(-1);
        const lastText = lastFinish?.text ?? '';
        if (!calledTools.has('lookupCity') || !calledTools.has('getForecast') || !String(lastText).trim()) {
          return;
        }

        // The final text reply is stored, and can be recalled after the run has drained.
        const messages = await persistedMessages(memory, thread, resource);
        const stored = messages.map(textParts).join('\n');
        // The stored reply must carry the same text the stream delivered. Storage keeps the
        // newlines between step segments that the concatenated stream deltas drop, so compare
        // with whitespace removed. Prose itself is excluded from the contract.
        const compact = (text: string) => text.replace(/\s+/g, '');
        expect(compact(stored)).toContain(compact(String(lastText)));
        // The user message is stored exactly once.
        expect(messages.filter(m => m.role === 'user')).toHaveLength(1);
      });
    });
  });
});
