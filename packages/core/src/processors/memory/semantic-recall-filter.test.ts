/**
 * `semanticRecall.filter` restricts recall to messages whose thread metadata matches. Before
 * #29352 only `Memory.recall()` applied it: during `agent.generate()` and `agent.stream()` the
 * SemanticRecall processor queried with the scope filter alone, and the embeddings it wrote for
 * agent-run messages carried no thread metadata for a filter to match.
 *
 * These tests run real agents with real memory processors. The only stand-ins are the model,
 * the embedder, and a small in-memory vector store that applies the filters it receives, so
 * the assertions check what the model was actually sent.
 *
 * @see https://github.com/mastra-ai/mastra/issues/29352
 */
import { convertArrayToReadableStream, MockEmbeddingModelV2, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { MockMemory } from '../../memory/mock';
import type { SemanticRecall as SemanticRecallConfig } from '../../memory/types';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraVector } from '../../vector';
import type {
  CreateIndexParams,
  DeleteIndexParams,
  DescribeIndexParams,
  IndexStats,
  QueryResult,
  QueryVectorParams,
  UpsertVectorParams,
  VectorFilter,
} from '../../vector';

import { globalEmbeddingCache } from './embedding-cache';
import { SemanticRecall } from './semantic-recall';

const RESOURCE_ID = 'user-1';
const WORK_FILTER: VectorFilter = { mode: { $eq: 'work' } };

const WORK_FACT = 'The deploy runs on the pizza server.';
const PERSONAL_FACT = 'My favourite pizza has olives.';

// Deterministic embedding: one dimension per keyword, so texts sharing a keyword are similar.
const KEYWORDS = ['pizza', 'deploy', 'olives', 'weather'];
function embed(text: string): number[] {
  const lower = text.toLowerCase();
  const raw = KEYWORDS.map(word => (lower.includes(word) ? 1 : 0) + 0.01);
  const norm = Math.hypot(...raw);
  return raw.map(value => value / norm);
}

function cosine(a: number[], b: number[]): number {
  return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

/**
 * Evaluates the subset of the vector filter syntax these tests use. Anything else throws, so a
 * filter this store cannot read fails the test instead of matching everything.
 */
function matchesFilter(metadata: Record<string, unknown>, filter: unknown): boolean {
  if (filter === undefined || filter === null) return true;
  if (typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error(`Unsupported filter: ${JSON.stringify(filter)}`);
  }
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$and') {
      if (!Array.isArray(condition)) throw new Error('$and expects an array');
      return condition.every(part => matchesFilter(metadata, part));
    }
    if (key.startsWith('$')) throw new Error(`Unsupported operator: ${key}`);
    if (condition !== null && typeof condition === 'object') {
      const operators = Object.entries(condition);
      return operators.every(([operator, expected]) => {
        if (operator !== '$eq') throw new Error(`Unsupported operator: ${operator}`);
        return metadata[key] === expected;
      });
    }
    return metadata[key] === condition;
  });
}

type StoredVector = { id: string; vector: number[]; metadata: Record<string, unknown> };

/** Self-embedding stores receive text: `documents` on upsert and `queryText` on query. */
type FilteringUpsertParams = Omit<UpsertVectorParams, 'vectors'> & { vectors?: number[][]; documents?: string[] };
type FilteringQueryParams = QueryVectorParams & { queryText?: string };

/** In-memory vector store that scores by cosine similarity and applies query filters. */
class FilteringVectorStore extends MastraVector {
  readonly queries: Array<{ filter: unknown; queryText?: string; queryVector?: number[] }> = [];
  private readonly indexes = new Map<string, StoredVector[]>();

  constructor(private readonly selfEmbedding = false) {
    super({ id: 'filtering-vector-store' });
  }

  override get isSelfEmbedding(): boolean {
    return this.selfEmbedding;
  }

  async createIndex({ indexName }: Pick<CreateIndexParams, 'indexName'>): Promise<void> {
    if (!this.indexes.has(indexName)) this.indexes.set(indexName, []);
  }

  async listIndexes(): Promise<string[]> {
    return [...this.indexes.keys()];
  }

  async describeIndex({ indexName }: DescribeIndexParams): Promise<IndexStats> {
    const rows = this.indexes.get(indexName) ?? [];
    return { dimension: KEYWORDS.length, count: rows.length, metric: 'cosine' };
  }

  async deleteIndex({ indexName }: DeleteIndexParams): Promise<void> {
    this.indexes.delete(indexName);
  }

  async upsert(params: FilteringUpsertParams): Promise<string[]> {
    const rows = this.indexes.get(params.indexName) ?? [];
    this.indexes.set(params.indexName, rows);
    const vectors = params.vectors ?? (params.documents ?? []).map(embed);
    const ids = vectors.map((_, i) => params.ids?.[i] ?? `vec-${rows.length + i}`);
    vectors.forEach((vector, i) => {
      rows.push({ id: ids[i]!, vector, metadata: params.metadata?.[i] ?? {} });
    });
    return ids;
  }

  async query(params: FilteringQueryParams): Promise<QueryResult[]> {
    this.queries.push({ filter: params.filter, queryText: params.queryText, queryVector: params.queryVector });
    const queryVector = params.queryVector ?? embed(params.queryText ?? '');
    return (this.indexes.get(params.indexName) ?? [])
      .filter(row => matchesFilter(row.metadata, params.filter))
      .map(row => ({ id: row.id, score: cosine(queryVector, row.vector), metadata: row.metadata }))
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK ?? 10);
  }

  async updateVector(): Promise<void> {
    throw new Error('updateVector is not used by semantic recall');
  }

  async deleteVector(): Promise<void> {
    throw new Error('deleteVector is not used by semantic recall');
  }

  async deleteVectors(): Promise<void> {
    throw new Error('deleteVectors is not used by semantic recall');
  }

  storedMetadata(): Array<Record<string, unknown>> {
    return [...this.indexes.values()].flat().map(row => row.metadata);
  }
}

const embedder = new MockEmbeddingModelV2<string>({
  doEmbed: async ({ values }) => ({ embeddings: values.map(embed) }),
});

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** Mock model that records every prompt it is sent. */
function createRecordingModel() {
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage,
        content: [{ type: 'text', text: 'ok' }],
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      prompts.push(JSON.stringify(prompt));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'ok' },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
      };
    },
  });
  return { model, prompts };
}

type RunMode = 'generate' | 'stream';

async function runAgent(agent: Agent, mode: RunMode, message: string, thread: string): Promise<void> {
  const options = { memory: { thread, resource: RESOURCE_ID } };
  if (mode === 'generate') {
    await agent.generate(message, options);
    return;
  }
  const result = await agent.stream(message, options);
  await result.consumeStream();
}

/**
 * Builds an agent whose memory uses resource-scoped semantic recall, then saves one work and
 * one personal message through agent runs, as an application would.
 */
async function setup({
  mode,
  semanticRecall,
  selfEmbedding = false,
}: {
  mode: RunMode;
  semanticRecall: SemanticRecallConfig;
  selfEmbedding?: boolean;
}) {
  const vector = new FilteringVectorStore(selfEmbedding);
  const memory = new MockMemory({
    storage: new InMemoryStore(),
    vector: vector,
    ...(selfEmbedding ? {} : { embedder }),
    options: { lastMessages: 1, semanticRecall },
  });
  const { model, prompts } = createRecordingModel();
  const agent = new Agent({ id: 'agent', name: 'agent', instructions: 'Answer briefly.', model, memory });

  await memory.createThread({ threadId: 'work-1', resourceId: RESOURCE_ID, metadata: { mode: 'work' } });
  await memory.createThread({ threadId: 'personal-1', resourceId: RESOURCE_ID, metadata: { mode: 'personal' } });
  await memory.createThread({ threadId: 'work-2', resourceId: RESOURCE_ID, metadata: { mode: 'work' } });

  await runAgent(agent, mode, WORK_FACT, 'work-1');
  await runAgent(agent, mode, PERSONAL_FACT, 'personal-1');

  return { agent, prompts, vector };
}

describe('semanticRecall.filter during agent runs (#29352)', () => {
  beforeEach(() => {
    globalEmbeddingCache.clear();
  });

  describe.each<RunMode>(['generate', 'stream'])('agent.%s', mode => {
    it('recalls only messages from threads that match the filter', async () => {
      const { agent, prompts, vector } = await setup({
        mode,
        semanticRecall: { topK: 5, messageRange: 0, scope: 'resource', filter: WORK_FILTER },
      });

      await runAgent(agent, mode, 'Tell me about pizza.', 'work-2');

      const sent = prompts.at(-1)!;
      expect(sent).toContain('pizza server');
      expect(sent).not.toContain('olives');
      // Same combination as Memory.recall(): scope filter AND user filter.
      expect(vector.queries.at(-1)!.filter).toEqual({ $and: [{ resource_id: RESOURCE_ID }, WORK_FILTER] });
    });

    it('recalls from every thread of the resource when no filter is set', async () => {
      const { agent, prompts, vector } = await setup({
        mode,
        semanticRecall: { topK: 5, messageRange: 0, scope: 'resource' },
      });

      await runAgent(agent, mode, 'Tell me about pizza.', 'work-2');

      const sent = prompts.at(-1)!;
      expect(sent).toContain('pizza server');
      expect(sent).toContain('olives');
      expect(vector.queries.at(-1)!.filter).toEqual({ resource_id: RESOURCE_ID });
    });

    // Some vector stores reject nested metadata values and the processor only logs a failed
    // upsert, so thread metadata is written only when a filter needs it.
    it('stores thread metadata on embeddings only when a filter is set', async () => {
      const filtered = await setup({
        mode,
        semanticRecall: { topK: 5, messageRange: 0, scope: 'resource', filter: WORK_FILTER },
      });
      const unfiltered = await setup({ mode, semanticRecall: { topK: 5, messageRange: 0, scope: 'resource' } });

      const filteredRows = filtered.vector.storedMetadata();
      expect(filteredRows.length).toBeGreaterThan(0);
      expect(filteredRows.filter(row => row.thread_id === 'work-1').every(row => row.mode === 'work')).toBe(true);
      expect(filteredRows.filter(row => row.thread_id === 'personal-1').every(row => row.mode === 'personal')).toBe(
        true,
      );

      const unfilteredRows = unfiltered.vector.storedMetadata();
      expect(unfilteredRows.length).toBeGreaterThan(0);
      expect(unfilteredRows.some(row => 'mode' in row)).toBe(false);
    });
  });

  it('applies the filter when the vector store embeds text itself', async () => {
    const { agent, prompts, vector } = await setup({
      mode: 'generate',
      selfEmbedding: true,
      semanticRecall: { topK: 5, messageRange: 0, scope: 'resource', filter: WORK_FILTER },
    });

    await runAgent(agent, 'generate', 'Tell me about pizza.', 'work-2');

    const sent = prompts.at(-1)!;
    expect(sent).toContain('pizza server');
    expect(sent).not.toContain('olives');
    const lastQuery = vector.queries.at(-1)!;
    expect(lastQuery.queryText).toBe('Tell me about pizza.');
    expect(lastQuery.filter).toEqual({ $and: [{ resource_id: RESOURCE_ID }, WORK_FILTER] });
  });

  it('combines the filter with the thread scope', async () => {
    const vector = new FilteringVectorStore();
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      vector: vector,
      embedder,
      options: {
        lastMessages: 1,
        semanticRecall: { topK: 5, messageRange: 0, scope: 'thread', filter: WORK_FILTER },
      },
    });
    const { model } = createRecordingModel();
    const agent = new Agent({ id: 'agent', name: 'agent', instructions: 'Answer briefly.', model, memory });
    await memory.createThread({ threadId: 'work-1', resourceId: RESOURCE_ID, metadata: { mode: 'work' } });

    await agent.generate('Tell me about pizza.', { memory: { thread: 'work-1', resource: RESOURCE_ID } });

    expect(vector.queries.at(-1)!.filter).toEqual({ $and: [{ thread_id: 'work-1' }, WORK_FILTER] });
  });

  // Durable and recovered runs rebuild the memory context with only the thread id
  // (agent/durable/durable-agent.ts, agent/durable/workflows/finalize-run.ts), and thread
  // metadata can change after a run starts, so the metadata is read from storage.
  it('stores the thread metadata from storage when the run context carries only the thread id', async () => {
    const vector = new FilteringVectorStore();
    const memory = new MockMemory({
      storage: new InMemoryStore(),
      vector,
      embedder,
      options: {
        lastMessages: 1,
        semanticRecall: { topK: 5, messageRange: 0, scope: 'resource', filter: WORK_FILTER },
      },
    });
    await memory.createThread({ threadId: 'work-1', resourceId: RESOURCE_ID, metadata: { mode: 'work' } });
    const processor = (await memory.getOutputProcessors()).find(p => p instanceof SemanticRecall);
    if (!(processor instanceof SemanticRecall)) throw new Error('Memory did not add a SemanticRecall processor');

    const requestContext = new RequestContext();
    requestContext.set('MastraMemory', { thread: { id: 'work-1' }, resourceId: RESOURCE_ID });
    await processor.processOutputResult({
      messages: [
        {
          id: 'durable-msg',
          threadId: 'work-1',
          resourceId: RESOURCE_ID,
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: WORK_FACT }] },
        },
      ],
      requestContext,
      abort: () => {
        throw new Error('aborted');
      },
    });

    expect(vector.storedMetadata()).toEqual([expect.objectContaining({ message_id: 'durable-msg', mode: 'work' })]);
  });
});
