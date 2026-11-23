import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { InMemoryStore } from '@mastra/core/storage';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// #30736: with a hosted embedder, recall search depends on that provider. When it rejects the request or never
// answers, recall must tell the agent to browse instead of failing the tool call or hanging the run.

const DIMENSIONS = 8;
function embed(text: string) {
  const values = new Array<number>(DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    let hash = 0;
    for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    values[hash % DIMENSIONS]! += 1;
  }
  const norm = Math.hypot(...values) || 1;
  return values.map(value => value / norm);
}

// An OpenAI-compatible embeddings endpoint: the edge between Memory and a hosted provider.
let mode: 'ok' | 'slow' | 'fail' | 'hang' = 'ok';
let abortedRequests = 0;
// Requests left to answer with 429 before the provider recovers.
let rateLimitedRequests = 0;
const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString()) as { model: string; input: string[] };
  if (rateLimitedRequests > 0) {
    rateLimitedRequests--;
    response.writeHead(429, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'Rate limit reached for requests', type: 'requests' } }));
    return;
  }
  if (mode === 'hang') {
    response.on('close', () => abortedRequests++);
    return;
  }
  if (mode === 'fail') {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({ error: { message: 'Incorrect API key provided: sk-…1234', type: 'invalid_request' } }),
    );
    return;
  }
  if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 1_500));
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify({
      object: 'list',
      model: body.model,
      data: body.input.map((text, index) => ({ object: 'embedding', index, embedding: embed(text) })),
      usage: { prompt_tokens: 0, total_tokens: 0 },
    }),
  );
});
let baseURL: string;
let vector: LibSQLVector;
let storage: InMemoryStore;

beforeAll(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  mode = 'ok';
  abortedRequests = 0;
  rateLimitedRequests = 0;
  vector = new LibSQLVector({ id: 'hosted-embedder', url: ':memory:' });
  storage = new InMemoryStore({ id: 'hosted-embedder' });
});
afterEach(async () => {
  await vector.close();
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

function openMemory(searchTimeoutMs?: number) {
  return new Memory({
    storage,
    vector,
    embedder: createOpenAI({ apiKey: 'test-key', baseURL }).embedding('text-embedding-3-small'),
    options: {
      lastMessages: 10,
      observationalMemory: {
        model: 'openai/gpt-4o-mini',
        scope: 'thread',
        retrieval: { vector: true, scope: 'thread', ...(searchTimeoutMs !== undefined ? { searchTimeoutMs } : {}) },
      },
    },
  });
}

/** A thread whose observational memory holds one observed group, indexed while the provider worked. */
async function seedObservedThread(memory: Memory) {
  const thread = await memory.createThread({ resourceId: 'resource', title: 'Editor setup' });
  await memory.saveMessages({
    messages: [
      {
        id: 'm1',
        threadId: thread.id,
        resourceId: 'resource',
        role: 'user',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        content: { format: 2, parts: [{ type: 'text', text: 'Use tabs, width four.' }] },
      },
    ],
  });
  const text = '- User prefers tabs for indentation with width four';
  const store = (await storage.getStore('memory'))!;
  const record = await store.initializeObservationalMemory({
    threadId: thread.id,
    resourceId: 'resource',
    scope: 'thread',
    config: {},
  });
  await store.updateActiveObservations({
    id: record.id,
    observations: `<observation-group id="indent" range="m1:m1">\n${text}\n</observation-group>`,
    tokenCount: 20,
    lastObservedAt: new Date('2026-01-01T10:00:00Z'),
  });
  await memory.indexObservation({
    text,
    groupId: 'indent',
    range: 'm1:m1',
    threadId: thread.id,
    resourceId: 'resource',
    recordId: record.id,
  });
  return thread;
}

async function recall(memory: Memory, threadId: string) {
  const tool = memory.listTools().recall!;
  return (await tool.execute!({ mode: 'search', query: 'tabs indentation' }, {
    memory,
    agent: { threadId, resourceId: 'resource' },
  } as never)) as { results: string; count: number };
}

describe('recall search with a hosted embedder (#30736)', () => {
  it('finds observed content while the provider answers', async () => {
    const memory = openMemory();
    const thread = await seedObservedThread(memory);

    const result = await recall(memory, thread.id);

    // The thread being searched is the current one, so the match comes back as a reference, not an excerpt.
    expect(result.count).toBe(1);
    expect(result.results).toContain('observation group: indent@');
  });

  it('points the agent at browsing instead of failing when the provider rejects the request', async () => {
    const memory = openMemory();
    const thread = await seedObservedThread(memory);
    mode = 'fail';
    const logged = vi.spyOn((memory as unknown as { logger: { error: () => void } }).logger, 'error');

    const result = await recall(memory, thread.id);

    expect(result.count).toBe(0);
    expect(result.results).toMatch(/^Search is unavailable right now\. Browse instead: use mode="messages"/);
    // Provider errors can carry account details; they go to the log, not into the conversation.
    expect(result.results).not.toContain('sk-');
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('Embedding the query failed: Incorrect API key'));
  });

  it('points the agent at browsing when the vector store fails, and logs that it was the store', async () => {
    const memory = openMemory();
    const thread = await seedObservedThread(memory);
    vi.spyOn(vector, 'query').mockRejectedValue(new Error('SQLITE_AUTH: permission denied for db.internal:5432'));
    const logged = vi.spyOn((memory as unknown as { logger: { error: () => void } }).logger, 'error');

    const result = await recall(memory, thread.id);

    expect(result.results).toMatch(/^Search is unavailable right now\. Browse instead/);
    expect(result.results).not.toContain('db.internal');
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('Querying the vector store failed: SQLITE_AUTH: permission denied'),
    );
  });

  it('stops waiting for a provider that never answers, and cancels the request', async () => {
    const memory = openMemory(500);
    const thread = await seedObservedThread(memory);
    mode = 'hang';
    const started = Date.now();

    const result = await recall(memory, thread.id);

    expect(Date.now() - started).toBeLessThan(5_000);
    expect(result.results).toMatch(/^Search is unavailable right now/);
    await expect.poll(() => abortedRequests).toBe(1);
  });

  it('lets a rate-limited search succeed on its last retry within the default limit', async () => {
    // Embedding retries 3 times, waiting 2 s, 4 s and 8 s. A search that only succeeds on the last retry
    // takes over 14 s, so the default limit has to outlast it or recall gives up on a search that would work.
    const memory = openMemory();
    const thread = await seedObservedThread(memory);
    rateLimitedRequests = 3;

    const result = await recall(memory, thread.id);

    expect(rateLimitedRequests).toBe(0);
    expect(result.count).toBe(1);
    expect(result.results).toContain('observation group: indent@');
  }, 45_000);

  it('waits as long as retrieval.searchTimeoutMs allows', async () => {
    // A provider that always takes 1.5 s, like a local model on a slow machine.
    const impatient = openMemory(500);
    const thread = await seedObservedThread(impatient);
    mode = 'slow';

    expect((await recall(impatient, thread.id)).results).toMatch(/^Search is unavailable right now/);

    const patient = openMemory(5_000);
    const result = await recall(patient, thread.id);
    expect(result.count).toBe(1);
    expect(result.results).toContain('observation group: indent@');
  }, 30_000);

  it.each([0, -1, Number.NaN, 1500.5, 2 ** 31])(
    'refuses retrieval.searchTimeoutMs of %s when Memory is created',
    searchTimeoutMs => {
      expect(() => openMemory(searchTimeoutMs)).toThrow(
        'retrieval.searchTimeoutMs` must be a whole number of milliseconds',
      );
    },
  );

  it('refuses an invalid retrieval.searchTimeoutMs passed with a single call', () => {
    const memory = openMemory();
    expect(() =>
      memory.listTools({ observationalMemory: { retrieval: { vector: true, searchTimeoutMs: 0 } } }),
    ).toThrow('retrieval.searchTimeoutMs` must be a whole number of milliseconds');
  });
});

describe('recall search with an embedder that ignores cancellation', () => {
  it('does not open the index or query the vector store for a search recall gave up on', async () => {
    let answered = false;
    const lateEmbedder = {
      specificationVersion: 'v2' as const,
      provider: 'late',
      modelId: 'late-embedder',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: true,
      // Ignores abortSignal and answers after recall stopped waiting.
      doEmbed: ({ values }: { values: string[] }) =>
        new Promise<{ embeddings: number[][] }>(resolve =>
          setTimeout(() => {
            answered = true;
            resolve({ embeddings: values.map(embed) });
          }, 300),
        ),
    };
    const memory = new Memory({
      storage,
      vector,
      embedder: lateEmbedder,
      embeddingDimension: DIMENSIONS,
      options: {
        lastMessages: 10,
        observationalMemory: {
          model: 'openai/gpt-4o-mini',
          scope: 'thread',
          retrieval: { vector: true, scope: 'thread', searchTimeoutMs: 100 },
        },
      },
    });
    const thread = await memory.createThread({ resourceId: 'resource' });
    const createIndex = vi.spyOn(vector, 'createIndex');
    const query = vi.spyOn(vector, 'query');

    expect((await recall(memory, thread.id)).results).toMatch(/^Search is unavailable right now/);

    await expect.poll(() => answered).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(createIndex).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('recall search with the local fastembed embedder', () => {
  it('keeps embedding after recall gave up on the first, slow embed', async () => {
    // Like the code-sdk fastembed worker: the first call downloads the model, and an abort cancels it.
    let calls = 0;
    let running = 0;
    let mostAtOnce = 0;
    const fastembed = {
      specificationVersion: 'v2' as const,
      provider: 'fastembed',
      modelId: 'bge-small-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: false,
      doEmbed: ({ values, abortSignal }: { values: string[]; abortSignal?: AbortSignal }) => {
        if (++calls === 1) {
          return new Promise<never>((_, reject) =>
            abortSignal?.addEventListener('abort', () => reject(abortSignal.reason), { once: true }),
          );
        }
        running++;
        mostAtOnce = Math.max(mostAtOnce, running);
        return new Promise<{ embeddings: number[][] }>(resolve =>
          setTimeout(() => {
            running--;
            resolve({ embeddings: values.map(embed) });
          }, 20),
        );
      },
    };
    const memory = new Memory({
      storage,
      vector,
      embedder: fastembed,
      embeddingDimension: DIMENSIONS,
      options: {
        lastMessages: 10,
        observationalMemory: {
          model: 'openai/gpt-4o-mini',
          scope: 'thread',
          retrieval: { vector: true, scope: 'thread', searchTimeoutMs: 200 },
        },
      },
    });
    const thread = await memory.createThread({ resourceId: 'resource' });

    expect((await recall(memory, thread.id)).results).toMatch(/^Search is unavailable right now/);

    // The next embed becomes the first one again, so embeds started meanwhile still wait for it.
    await Promise.all([
      memory.indexObservation({
        text: '- User prefers tabs for indentation with width four',
        groupId: 'indent',
        range: 'm1:m1',
        threadId: 'other-thread',
        resourceId: 'resource',
        recordId: 'record',
      }),
      memory.searchMessages({ query: 'deploy schedule', resourceId: 'resource' }),
    ]);
    expect(mostAtOnce).toBe(1);

    const { results } = await memory.searchMessages({ query: 'tabs indentation', resourceId: 'resource' });
    expect(results.map(result => result.groupId)).toEqual(['indent']);
  });

  it('does not embed a search that was cancelled while waiting for the first fastembed embed', async () => {
    const embedded: string[][] = [];
    const fastembed = {
      specificationVersion: 'v2' as const,
      provider: 'fastembed',
      modelId: 'bge-small-en-v1.5',
      maxEmbeddingsPerCall: 256,
      supportsParallelCalls: false,
      doEmbed: async ({ values }: { values: string[] }) => {
        embedded.push(values);
        // The first embed stands in for the model download.
        if (embedded.length === 1) await new Promise(resolve => setTimeout(resolve, 200));
        return { embeddings: values.map(embed) };
      },
    };
    const memory = new Memory({ storage, vector, embedder: fastembed, embeddingDimension: DIMENSIONS });

    const first = memory.searchMessages({ query: 'tabs indentation', resourceId: 'resource' });
    const cancel = new AbortController();
    const queued = memory.searchMessages({
      query: 'deploy schedule',
      resourceId: 'resource',
      abortSignal: cancel.signal,
    });
    // Cancel once it is queued behind the first embed, which takes 200 ms.
    await new Promise(resolve => setTimeout(resolve, 50));
    const cancelledAt = Date.now();
    cancel.abort(new Error('recall gave up'));

    await expect(queued).rejects.toThrow('recall gave up');
    // It stopped waiting as soon as it was cancelled, not ~150 ms later when the first embed finished.
    expect(Date.now() - cancelledAt).toBeLessThan(100);
    await first;
    expect(embedded).toEqual([['tabs indentation']]);
  });
});
