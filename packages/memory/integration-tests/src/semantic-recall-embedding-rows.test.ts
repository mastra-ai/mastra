/**
 * Ported from validation harness case T42 (semantic-recall).
 *
 * Durable and evented runs used to write two or three vector rows per message: the SemanticRecall
 * output processor keyed rows by message id, then the save queue re-embedded the same messages
 * through Memory.saveMessages under random ids. These tests run plain, durable and evented agents
 * against a real LibSQL vector index and check the index after each run.
 */
import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const FACT = 'the code word is ZEBRA-7731';
const OTHER = 'the color is GIRAFFE-blue';
const FILLER = 3;
const CUSTOM_INDEX = 'custom_recall_index';

// Same keyword embedder as the harness: similarity depends only on the keyword, so recall is
// deterministic without a provider.
const axis = (text: string) =>
  /ZEBRA/i.test(text) ? [1, 0, 0, 0] : /GIRAFFE/i.test(text) ? [0, 1, 0, 0] : [0, 0, 1, 0];

function keywordEmbedder({ maxInputTokens }: { maxInputTokens?: number } = {}) {
  const embedded: string[] = [];
  let failing = false;
  return {
    embedded,
    fail: (value: boolean) => {
      failing = value;
    },
    model: {
      specificationVersion: 'v2' as const,
      provider: 'keyword',
      modelId: 'keyword-embedding',
      maxEmbeddingsPerCall: 128,
      supportsParallelCalls: true,
      ...(maxInputTokens ? { maxInputTokens } : {}),
      async doEmbed({ values }: { values: string[] }) {
        if (failing) throw new Error('embedder unavailable');
        embedded.push(...values);
        return { embeddings: values.map(axis) };
      },
    },
  };
}

/**
 * A LibSQL vector store that counts how often each row id is written, per index. `:memory:`
 * makes LibSQL score every row exactly; its indexed file-backed search is approximate and can
 * miss the best row in a large index, which is a separate concern.
 */
function countingVector() {
  const vector = new LibSQLVector({ id: randomUUID(), url: ':memory:' });
  const writes = new Map<string, number>();
  const upsert = vector.upsert.bind(vector);
  vector.upsert = (async (args: Parameters<LibSQLVector['upsert']>[0]) => {
    for (const id of args.ids ?? []) {
      const key = `${args.indexName}/${id}`;
      writes.set(key, (writes.get(key) ?? 0) + 1);
    }
    return upsert(args);
  }) as LibSQLVector['upsert'];
  return { vector, writes };
}

/** Every row in an index, read with a vector that scores all rows equally. */
async function readRows(vector: LibSQLVector, indexName?: string) {
  const name = indexName ?? (await vector.listIndexes())[0];
  if (!name) return [];
  return vector.query({ indexName: name, queryVector: [0.5, 0.5, 0.5, 0.5], topK: 1000 });
}

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

describe.each(['plain', 'durable', 'evented'] as const)('Semantic recall rows on %s', engine => {
  it.each(['thread', 'resource', 'custom-index'] as const)(
    'writes each message once and recalls the fact once (%s)',
    async variant => {
      const scope = variant === 'resource' ? 'resource' : 'thread';
      const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
      const { vector, writes } = countingVector();
      const embedder = keywordEmbedder();
      const memory = new Memory({
        storage,
        vector,
        embedder: embedder.model,
        options: {
          lastMessages: 2,
          semanticRecall: {
            topK: 1,
            messageRange: 0,
            scope,
            ...(variant === 'custom-index' ? { indexName: CUSTOM_INDEX } : {}),
          },
          generateTitle: false,
          workingMemory: { enabled: false },
        },
      });
      const base = new Agent({
        id: randomUUID(),
        name: 'Recall',
        instructions: 'Answer briefly.',
        memory,
        model: createOpenAI({ apiKey: 'test-key', baseURL: `${llm.url}/v1` }).chat('gpt-4o'),
      });
      const agent =
        engine === 'plain'
          ? base
          : engine === 'durable'
            ? createDurableAgent({ agent: base })
            : createEventedAgent({ agent: base });
      const mastra = new Mastra({ agents: { agent }, storage, logger: false });

      const resource = randomUUID();
      const threadA = randomUUID();
      const threadB = randomUUID();
      const turn = async (prompt: string, thread: string, reply: string) => {
        llm.clearFixtures();
        llm.clearRequests();
        llm.on({ endpoint: 'chat' }, { content: reply });
        const result = await agent.stream(prompt, { memory: { thread, resource } });
        const output = 'output' in result ? result.output : result;
        await output.consumeStream();
        if ('cleanup' in result) result.cleanup();
        return llm.getRequests();
      };

      try {
        await turn(FACT, threadA, 'noted');
        await turn(OTHER, threadA, 'noted');
        for (let i = 1; i <= FILLER; i++) await turn(`filler ${i}`, threadA, 'noted');
        const askThread = scope === 'resource' ? threadB : threadA;
        const requests = await turn('what was the code word ZEBRA?', askThread, 'answered');

        const store = (await storage.getStore('memory'))!;
        const persisted = [
          ...(await store.listMessages({ threadId: threadA, perPage: false })).messages,
          ...(scope === 'resource' ? (await store.listMessages({ threadId: threadB, perPage: false })).messages : []),
        ];
        // The index the processor recalls from: a custom one when set.
        const rows = await readRows(vector, variant === 'custom-index' ? CUSTOM_INDEX : undefined);

        // One row per persisted message, keyed by the message id.
        expect(rows.map(row => row.id).sort()).toEqual(persisted.map(message => message.id).sort());
        expect(rows.every(row => row.id === row.metadata?.message_id)).toBe(true);

        // The second writer skips what the first one embedded, so no row is written twice.
        expect([...writes.entries()].filter(([, count]) => count > 1)).toEqual([]);

        const prompt = JSON.stringify(requests.at(-1)!.body);
        expect(prompt.match(/ZEBRA-7731/g)).toHaveLength(1);
        expect(prompt).not.toContain('GIRAFFE-blue');
      } finally {
        await mastra.shutdown?.({ drainTimeout: 1000 });
      }
    },
  );
});

describe('Memory message rows', () => {
  async function setup({ maxChunkChars, maxInputTokens }: { maxChunkChars?: number; maxInputTokens?: number } = {}) {
    const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
    const { vector, writes } = countingVector();
    const embedder = keywordEmbedder({ maxInputTokens });
    const memory = new Memory({
      storage,
      vector,
      embedder: embedder.model,
      options: {
        semanticRecall: { topK: 1, messageRange: 0, ...(maxChunkChars ? { maxChunkChars } : {}) },
        generateTitle: false,
      },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    await memory.createThread({ threadId, resourceId });
    const message = (text: string, id = randomUUID()) => ({
      id,
      threadId,
      resourceId,
      role: 'user' as const,
      createdAt: new Date(),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
    });
    return { memory, vector, writes, embedder, message };
  }

  it('writes one row per chunk and replaces them when the message is saved again', async () => {
    const { memory, vector, message } = await setup({ maxChunkChars: 40 });
    const long = message('zebra stripes '.repeat(20).trim());

    await memory.saveMessages({ messages: [long] });
    const first = await readRows(vector);
    await memory.saveMessages({ messages: [long] });
    const second = await readRows(vector);

    expect(first.length).toBeGreaterThan(1);
    expect(first.map(row => row.id)).toContain(long.id);
    expect(first.every(row => row.metadata?.message_id === long.id)).toBe(true);
    expect(second.map(row => row.id).sort()).toEqual(first.map(row => row.id).sort());
  });

  it("skips messages already in the run's embedded-messages record", async () => {
    const { memory, writes, embedder, message } = await setup();
    const embeddedMessages = new Map<string, string>();
    const saved = message('the code word is ZEBRA-7731');

    await memory.saveMessages({ messages: [saved], embeddedMessages });
    await memory.saveMessages({ messages: [saved], embeddedMessages });

    expect([...writes.values()]).toEqual([1]);
    expect(embedder.embedded.filter(text => text.includes('ZEBRA-7731'))).toHaveLength(1);
  });

  it('sizes chunks from the embedder input limit when maxChunkChars is not set', async () => {
    const { memory, vector, embedder, message } = await setup({ maxInputTokens: 512 });
    const long = message('word '.repeat(1000).trim());

    await memory.saveMessages({ messages: [long] });

    // 512 tokens is converted with headroom to 1,536 characters per chunk.
    expect(await readRows(vector)).toHaveLength(4);
    expect(embedder.embedded).toHaveLength(4);
    expect(embedder.embedded.every(chunk => chunk.length <= 1536)).toBe(true);
  });

  it('leaves one row when an edit shortens a long message', async () => {
    const { memory, vector, message } = await setup({ maxChunkChars: 40 });
    const long = message('zebra stripes '.repeat(20).trim());
    await memory.saveMessages({ messages: [long] });
    expect((await readRows(vector)).length).toBeGreaterThan(1);

    await memory.updateMessages({
      messages: [{ id: long.id, content: { format: 2, parts: [{ type: 'text', text: 'short zebra' }] } }],
    });

    const rows = await readRows(vector);
    expect(rows.map(row => [row.id, row.metadata?.content])).toEqual([[long.id, 'short zebra']]);
  });

  it('keeps the old row searchable when the embedder fails during an edit', async () => {
    const { memory, vector, embedder, message } = await setup();
    const saved = message('the code word is ZEBRA-7731');
    await memory.saveMessages({ messages: [saved] });

    embedder.fail(true);
    await expect(
      memory.updateMessages({
        messages: [{ id: saved.id, content: { format: 2, parts: [{ type: 'text', text: 'new text' }] } }],
      }),
    ).rejects.toThrow('embedder unavailable');

    const rows = await readRows(vector);
    expect(rows.map(row => [row.id, row.metadata?.content])).toEqual([[saved.id, 'the code word is ZEBRA-7731']]);
  });
});
