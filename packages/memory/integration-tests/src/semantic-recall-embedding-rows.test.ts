/**
 * Ported from validation harness case T42 (semantic-recall), COR-1321.
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

// Same keyword embedder as the harness: similarity depends only on the keyword, so recall is
// deterministic without a provider.
const axis = (text: string) =>
  /ZEBRA/i.test(text) ? [1, 0, 0, 0] : /GIRAFFE/i.test(text) ? [0, 1, 0, 0] : [0, 0, 1, 0];

function keywordEmbedder() {
  const embedded: string[] = [];
  return {
    embedded,
    model: {
      specificationVersion: 'v2' as const,
      provider: 'keyword',
      modelId: 'keyword-embedding',
      maxEmbeddingsPerCall: 128,
      supportsParallelCalls: true,
      async doEmbed({ values }: { values: string[] }) {
        embedded.push(...values);
        return { embeddings: values.map(axis) };
      },
    },
  };
}

/** Every row in the index, read with a vector that scores all rows equally. */
async function readRows(vector: LibSQLVector) {
  const [indexName] = await vector.listIndexes();
  if (!indexName) return [];
  return vector.query({ indexName, queryVector: [0.5, 0.5, 0.5, 0.5], topK: 1000 });
}

let llm: LLMock;
beforeAll(async () => {
  llm = new LLMock({ port: 0 });
  await llm.start();
});
afterAll(async () => {
  await llm.stop();
});

describe.each(['plain', 'durable', 'evented'] as const)('Semantic recall rows on %s (COR-1321)', engine => {
  it.each(['thread', 'resource'] as const)(
    'writes one row per message and recalls the fact once (%s scope)',
    async scope => {
      // `:memory:` makes LibSQL score every row exactly. Its indexed file-backed search is
      // approximate and can miss the best row in a large index, which is a separate concern.
      const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
      const vector = new LibSQLVector({ id: randomUUID(), url: ':memory:' });
      const embedder = keywordEmbedder();
      const memory = new Memory({
        storage,
        vector,
        embedder: embedder.model,
        options: {
          lastMessages: 2,
          semanticRecall: { topK: 1, messageRange: 0, scope },
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
        const rows = await readRows(vector);

        // One row per persisted message, keyed by the message id.
        expect(rows.map(row => row.id).sort()).toEqual(persisted.map(message => message.id).sort());
        expect(rows.every(row => row.id === row.metadata?.message_id)).toBe(true);

        // A text is embedded once per process, whichever writer reaches it first.
        expect(new Set(embedder.embedded).size).toBe(embedder.embedded.length);

        const prompt = JSON.stringify(requests.at(-1)!.body);
        expect(prompt.match(/ZEBRA-7731/g)).toHaveLength(1);
        expect(prompt).not.toContain('GIRAFFE-blue');
      } finally {
        await mastra.shutdown?.({ drainTimeout: 1000 });
      }
    },
  );
});

describe('Memory.saveMessages with long messages (COR-1321)', () => {
  it('writes one row per chunk and replaces them when the message is saved again', async () => {
    const storage = new LibSQLStore({ id: randomUUID(), url: ':memory:' });
    const vector = new LibSQLVector({ id: randomUUID(), url: ':memory:' });
    const memory = new Memory({
      storage,
      vector,
      embedder: keywordEmbedder().model,
      options: { semanticRecall: { topK: 1, messageRange: 0, maxChunkChars: 40 }, generateTitle: false },
    });
    const threadId = randomUUID();
    const resourceId = randomUUID();
    await memory.createThread({ threadId, resourceId });
    const message = {
      id: randomUUID(),
      threadId,
      resourceId,
      role: 'user' as const,
      createdAt: new Date(),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'zebra stripes '.repeat(20).trim() }] },
    };

    await memory.saveMessages({ messages: [message] });
    const first = await readRows(vector);
    await memory.saveMessages({ messages: [message] });
    const second = await readRows(vector);

    expect(first.length).toBeGreaterThan(1);
    expect(first.map(row => row.id)).toContain(message.id);
    expect(first.every(row => row.metadata?.message_id === message.id)).toBe(true);
    expect(second.map(row => row.id).sort()).toEqual(first.map(row => row.id).sort());
  });
});
