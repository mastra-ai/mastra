/**
 * Concurrent OM-managed working memory updates (#28993)
 *
 * Working memory is resource-scoped, so every thread of a resource shares one document, while Observational
 * Memory is thread-scoped, so the Observers of sibling threads run at the same time. Each Observer reads the
 * working memory before its model call and saves after it. When the Observer wrote back the whole document,
 * the last writer silently dropped the facts the other thread had just saved.
 *
 * Runs two real Agent + Memory turns concurrently on sibling threads of one resource, with a real OpenAI
 * provider pointed at AIMock for the actor, the Observer and the structured working-memory extraction.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const RESOURCE = 'shared-resource';
const SEED = { seed: 'existing' };

const threads = [
  {
    id: 'thread-budget',
    marker: 'BUDGET_MARKER',
    request: `BUDGET_MARKER: my travel budget is 500 dollars. ${'Please remember it. '.repeat(10)}`,
    observation: '* 🔴 User travel budget is 500 dollars',
    // A model following the old full-document prompt returns the snapshot it was shown plus its own fact.
    extracted: { ...SEED, budget: '500 dollars' },
  },
  {
    id: 'thread-tone',
    marker: 'TONE_MARKER',
    request: `TONE_MARKER: please always answer in a formal tone. ${'Please remember it. '.repeat(10)}`,
    observation: '* 🔴 User wants a formal tone',
    extracted: { ...SEED, tone: 'formal' },
  },
];

const schema = z.object({
  seed: z.string().optional(),
  budget: z.string().optional(),
  tone: z.string().optional(),
});

let mock: LLMock;

const mentions = (req: ChatCompletionRequest, marker: string) => JSON.stringify(req.messages).includes(marker);
const isStructured = (req: ChatCompletionRequest) => Boolean((req as { response_format?: unknown }).response_format);

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  await mock.stop();
});

describe('OM-managed resource-scoped working memory with thread-scoped OM', { timeout: 30_000 }, () => {
  it('keeps the facts saved by sibling threads that observe at the same time', async () => {
    for (const thread of threads) {
      mock.on(
        { endpoint: 'chat', model: OBSERVER, predicate: req => isStructured(req) && mentions(req, thread.marker) },
        { content: JSON.stringify({ 'working-memory': thread.extracted }) },
        // Keeps both extractions in flight together, like two Observers whose model calls overlap.
        { latency: 200 },
      );
      mock.on(
        { endpoint: 'chat', model: OBSERVER, predicate: req => !isStructured(req) && mentions(req, thread.marker) },
        { content: `<observations>\n${thread.observation}\n</observations>` },
      );
    }
    mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Noted.' });

    const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
    const memory = new Memory({
      storage: new InMemoryStore(),
      options: {
        workingMemory: { enabled: true, scope: 'resource', schema },
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: {
            model: openai.chat(OBSERVER),
            messageTokens: 20,
            bufferTokens: false,
            manageWorkingMemory: true,
          },
          reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
        },
      },
    });
    const agent = new Agent({
      id: 'concurrent-wm-agent',
      name: 'Concurrent WM Agent',
      instructions: 'You are a helpful assistant.',
      model: openai.chat(ACTOR),
      memory,
    });
    await memory.updateWorkingMemory({
      threadId: threads[0]!.id,
      resourceId: RESOURCE,
      workingMemory: JSON.stringify(SEED),
    });

    await Promise.all(
      threads.map(thread => agent.generate(thread.request, { memory: { thread: thread.id, resource: RESOURCE } })),
    );

    const structuredCalls = mock.getRequests().filter(req => req.body?.model === OBSERVER && isStructured(req.body));
    expect(structuredCalls).toHaveLength(2);
    const workingMemory = await memory.getWorkingMemory({ threadId: threads[0]!.id, resourceId: RESOURCE });
    expect(JSON.parse(workingMemory!)).toEqual({ seed: 'existing', budget: '500 dollars', tone: 'formal' });
  });
});
