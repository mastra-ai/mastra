/**
 * Process-wide limit on concurrent Observer runs.
 *
 * Many threads crossing their observation threshold together used to start that many Observer
 * runs at once. Each run builds a large prompt and streams a long reply on the shared event loop,
 * so a burst stalled every agent in the process. `maxConcurrentModelCalls` caps the runs in
 * flight; the rest wait for a slot and still observe their own messages exactly once.
 *
 * Runs real Agent + Memory turns with a real OpenAI provider pointed at AIMock for both the
 * actor and the Observer, and measures concurrency at the mock server.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { InMemoryDB, InMemoryMemory, InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Memory } from '../../../index';
import { getOMModelCallStats } from '../model-call-limiter';
import { ObservationalMemory } from '../observational-memory';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const RESOURCE = 'concurrency-resource';
const THREADS = 6;
const OBSERVER_LATENCY_MS = 150;

let mock: LLMock;
let inFlight = 0;
let peakInFlight = 0;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
  inFlight = 0;
  peakInFlight = 0;
});

afterAll(async () => {
  await mock.stop();
});

const markerFor = (i: number) => `PROJECT_CODENAME_${i}`;

function threadMarkerIn(request: ChatCompletionRequest): string {
  const body = JSON.stringify(request.messages);
  const match = body.match(/PROJECT_CODENAME_\d+/);
  if (!match) throw new Error('Observer request carries no thread marker');
  return match[0];
}

function installFixtures() {
  mock.on({ endpoint: 'chat', model: OBSERVER }, async request => {
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    try {
      await new Promise(resolve => setTimeout(resolve, OBSERVER_LATENCY_MS));
      return {
        content: `<observations>\n* 🔴 User is working on project ${threadMarkerIn(request)}\n</observations>`,
      };
    } finally {
      inFlight--;
    }
  });
  mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Noted.' });
}

async function runBurst(maxConcurrentModelCalls: number | undefined) {
  installFixtures();
  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
  const store = new InMemoryStore();
  const agent = new Agent({
    id: 'concurrency-agent',
    name: 'Concurrency Agent',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    memory: new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          ...(maxConcurrentModelCalls === undefined ? {} : { maxConcurrentModelCalls }),
          observation: { model: openai.chat(OBSERVER), messageTokens: 20, bufferTokens: false },
          reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
        },
      },
    }),
  });

  const threadIds = Array.from({ length: THREADS }, (_, i) => `concurrency-thread-${i}`);
  // Every thread crosses its threshold on the same turn, as many active threads do after a deploy.
  const results = await Promise.all(
    threadIds.map((thread, i) =>
      agent.generate(`I am starting project ${markerFor(i)}. ${'Please keep track of it. '.repeat(10)}`, {
        memory: { thread, resource: RESOURCE },
      }),
    ),
  );

  const memoryStore = (await store.getStore('memory'))!;
  const records = await Promise.all(threadIds.map(thread => memoryStore.getObservationalMemory(thread, RESOURCE)));
  const observerCalls = mock.getRequests().filter(request => request.body?.model === OBSERVER);
  return { results, records, observerCalls };
}

describe('Observer concurrency limit', { timeout: 30_000 }, () => {
  it.each([1, 2, 3])(
    'runs at most %i Observer calls at once when every thread crosses its threshold together',
    async limit => {
      const { results, records, observerCalls } = await runBurst(limit);

      expect(peakInFlight).toBe(limit);
      expect(observerCalls).toHaveLength(THREADS);
      for (const result of results) {
        expect(result.tripwire).toBeUndefined();
        expect(result.text).toBe('Noted.');
      }
      records.forEach((record, i) => {
        // Each thread observed its own messages, once, and nothing from another thread.
        const observations = record?.activeObservations ?? '';
        expect(observations.match(/PROJECT_CODENAME_\d+/g)).toEqual([markerFor(i)]);
        expect(record?.lastObservedAt).toBeInstanceOf(Date);
      });
      expect(getOMModelCallStats()).toEqual({ active: 0, waiting: 0 });
    },
  );

  it('caps a burst at 3 Observer calls by default', async () => {
    const { observerCalls } = await runBurst(undefined);

    expect(peakInFlight).toBe(3);
    expect(observerCalls).toHaveLength(THREADS);
  });

  it('runs every Observer call at once when the limit is Infinity', async () => {
    const { observerCalls } = await runBurst(Infinity);

    expect(peakInFlight).toBe(THREADS);
    expect(observerCalls).toHaveLength(THREADS);
  });

  it('lets another thread observe while a failed Observer call waits to retry', async () => {
    const requests: Array<{ marker: string; at: number }> = [];
    mock.on({ endpoint: 'chat', model: OBSERVER }, async request => {
      const marker = threadMarkerIn(request);
      requests.push({ marker, at: Date.now() });
      if (requests.length === 1) {
        return { error: { message: 'overloaded', type: 'server_error' }, status: 503 };
      }
      return { content: `<observations>\n* 🔴 User is working on project ${marker}\n</observations>` };
    });
    mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Noted.' });
    const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
    const agent = new Agent({
      id: 'retry-agent',
      name: 'Retry Agent',
      instructions: 'You are a helpful assistant.',
      model: openai.chat(ACTOR),
      memory: new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            enabled: true,
            maxConcurrentModelCalls: 1,
            observation: { model: openai.chat(OBSERVER), messageTokens: 20, bufferTokens: false },
            reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
          },
        },
      }),
    });

    await Promise.all(
      [0, 1].map(i =>
        agent.generate(`I am starting project ${markerFor(i)}. ${'Please keep track of it. '.repeat(10)}`, {
          memory: { thread: `retry-thread-${i}`, resource: RESOURCE },
        }),
      ),
    );

    // The failed thread retries after a backoff of about a second; the other thread's call runs meanwhile.
    const [failed, next, retry] = requests;
    expect(requests).toHaveLength(3);
    expect(next!.marker).not.toBe(failed!.marker);
    expect(retry!.marker).toBe(failed!.marker);
    expect(getOMModelCallStats()).toEqual({ active: 0, waiting: 0 });
  });

  it('rejects a limit that is not a positive integer', () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    for (const maxConcurrentModelCalls of [0, -1, 1.5, Number.NaN]) {
      expect(() => new ObservationalMemory({ storage, scope: 'thread', maxConcurrentModelCalls })).toThrow(
        /maxConcurrentModelCalls/,
      );
    }
  });
});
