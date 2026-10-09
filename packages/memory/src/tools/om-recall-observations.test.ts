import { standardSchemaToJSONSchema } from '@mastra/core/schema';
import { InMemoryStore } from '@mastra/core/storage';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from '../index';
import { wrapInObservationGroup } from '../processors/observational-memory/observation-groups';
import type { OMTimelineEngine } from './om-observations';
import { recallTool, searchMessagesForResource } from './om-tools';

type RecallMemory = Parameters<typeof searchMessagesForResource>[0]['memory'];
const date = new Date('2024-01-01T12:00:00Z');
const thread = { id: 'thread', resourceId: 'resource', title: 'History', createdAt: date, updatedAt: date };
const group = (id: string) => wrapInObservationGroup(`Date: Jan 1, 2024\n${id} details`, `${id}-start:${id}-end`, id);
function setup() {
  const memory: RecallMemory = {
    getMemoryStore: async () => ({ listMessagesById: async () => ({ messages: [] }) }),
    recall: async () => ({ messages: [], total: 0, page: 0, perPage: 20, hasMore: false }),
    listThreads: async () => ({ threads: [thread], total: 1, hasMore: false, page: 0 }),
    getThreadById: vi.fn(async ({ threadId }) => (threadId === thread.id ? thread : null)),
    searchMessages: vi.fn(async () => ({
      results: [
        {
          threadId: 'thread',
          groupId: 'c',
          score: 0.99,
          observedAt: new Date('2024-01-03T12:00:00Z'),
          text: 'Date: Jan 3, 2024\nC',
        },
        { threadId: 'thread', groupId: 'a', score: 0.8, observedAt: date, text: 'Date: Jan 1, 2024\nA' },
        { threadId: 'thread', groupId: 'b', score: 0.2, observedAt: new Date('2024-01-02T12:00:00Z'), text: 'B' },
      ],
    })),
  };
  const om: OMTimelineEngine = {
    getHistory: vi.fn(async (thread, _resource, _limit, options) => {
      if (thread === 'current') {
        return [
          { id: 'current', threadId: 'current', generationCount: 0, observedTimezone: 'UTC', activeObservations: '' },
        ];
      }
      if (options?.beforeGeneration !== undefined || options?.afterGeneration !== undefined) return [];
      return [
        {
          id: 'record',
          threadId: 'thread',
          generationCount: 0,
          observedTimezone: 'UTC',
          activeObservations: ['a', 'b', 'c'].map(group).join('\n'),
        },
      ];
    }),
  };
  return { memory, om };
}

describe('recall observations integration', () => {
  it('selects by similarity, renders chronologically with dates, and reports skipped groups', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-04T01:00:00Z'));
    try {
      const { memory, om } = setup();
      const result = await searchMessagesForResource({
        memory,
        om,
        resourceId: 'resource',
        currentThreadId: 'current',
        query: 'topic',
        topK: 2,
      });
      expect(result.count).toBe(2);
      expect(result.results.indexOf('observation group: a')).toBeLessThan(
        result.results.indexOf('observation group: c'),
      );
      expect(result.results).not.toContain('observation group: b');
      expect(result.results).toContain('Observation groups may be hidden between these results');
      expect(result.results).toContain('observed: 2024-01-01 12:00:00Z (3 days ago)');
      expect(result.results).toContain('Date: Jan 1, 2024 (3 days ago)');
      expect(result.results).not.toContain('thread updated');
      expect(om.getHistory).toHaveBeenCalledTimes(1);
      expect(om.getHistory).toHaveBeenCalledWith('current', 'resource', 1);
    } finally {
      vi.useRealTimers();
    }
  });
  it('keeps undated hits after dated hits and surfaces truncation with recovery guidance', async () => {
    const { memory, om } = setup();
    memory.searchMessages = async () => ({
      results: [
        { threadId: 'thread', groupId: 'unknown', score: 1, text: 'undated' },
        { threadId: 'thread', groupId: 'dated', score: 0.5, observedAt: date, text: 'many words '.repeat(1000) },
      ],
    });
    const full = await searchMessagesForResource({ memory, resourceId: 'resource', query: 'x', maxTokens: 10000 });
    expect(full.results.indexOf('observation group: dated')).toBeLessThan(
      full.results.indexOf('observation group: unknown'),
    );
    const limited = await searchMessagesForResource({ memory, om, resourceId: 'resource', query: 'x', maxTokens: 150 });
    expect(limited.results).toContain('All 2 selected matching groups are shown; some excerpts are truncated');
    expect(limited.results).toContain('omitting direction');
    expect(limited.results).toContain('observation group: unknown');
    expect(limited.results).not.toContain('Narrow the query');
  });
  it('shares the text budget across hits and gives unused space to higher ranks before chronological rendering', async () => {
    const { memory, om } = setup();
    memory.searchMessages = async () => ({
      results: [
        {
          threadId: 'thread',
          groupId: 'c',
          score: 0.99,
          observedAt: new Date('2024-01-03'),
          text: 'newest '.repeat(1000),
        },
        { threadId: 'thread', groupId: 'a', score: 0.8, observedAt: date, text: 'oldest '.repeat(1000) },
        { threadId: 'thread', groupId: 'b', score: 0.2, observedAt: new Date('2024-01-02'), text: 'short' },
      ],
    });
    const result = await searchMessagesForResource({ memory, om, resourceId: 'resource', query: 'x', maxTokens: 300 });
    const excerpts = [...result.results.matchAll(/```text\n([\s\S]*?)^```/gm)].map(match => match[1].trimEnd());
    const tokens = excerpts.map(estimateTokenCount);
    expect(result.count).toBe(3);
    expect(excerpts).toHaveLength(3);
    expect(excerpts[0]).toMatch(/^oldest/);
    expect(excerpts[1]).toBe('short');
    expect(excerpts[2]).toMatch(/^newest/);
    expect(tokens[0]).toBeLessThanOrEqual(100);
    expect(tokens[2]).toBeGreaterThan(100);
    expect(tokens.reduce((sum, count) => sum + count, 0)).toBeLessThanOrEqual(300);
    expect(estimateTokenCount(result.results)).toBeGreaterThan(300);
    expect(result.results.match(/\[Excerpt truncated\]/g)).toHaveLength(2);
  });
  it('keeps every selected hit visible at the maximum result count', async () => {
    const { memory } = setup();
    memory.searchMessages = async () => ({
      results: Array.from({ length: 20 }, (_, index) => ({
        threadId: 'thread',
        groupId: `group-${index}`,
        score: 1 - index / 20,
        observedAt: new Date(Date.UTC(2024, 0, 20 - index)),
        text: `hit${index} `.repeat(1000),
      })),
    });
    const result = await searchMessagesForResource({ memory, resourceId: 'resource', query: 'x', topK: 20 });
    const excerpts = [...result.results.matchAll(/```text\n([\s\S]*?)^```/gm)].map(match => match[1].trimEnd());
    expect(result.count).toBe(20);
    expect(excerpts).toHaveLength(20);
    expect(excerpts.every(text => text.length > 0)).toBe(true);
    expect(excerpts[0]).toMatch(/^hit19 /);
    expect(excerpts[19]).toMatch(/^hit0 /);
    expect(excerpts.reduce((sum, text) => sum + estimateTokenCount(text), 0)).toBeLessThanOrEqual(2000);
    expect(result.results).toContain('All 20 selected matching groups are shown');
    expect(result.results).toContain('mode="messages"');
    expect(result.results).not.toContain('mode="observations"');
  });
  it('preserves complete gap navigation when the observation excerpts are shortened', async () => {
    const { memory, om } = setup();
    const search = memory.searchMessages!;
    memory.searchMessages = async input => ({
      results: (await search(input)).results.map(hit => ({ ...hit, text: 'dense observation '.repeat(1000) })),
    });
    const result = await searchMessagesForResource({
      memory,
      om,
      resourceId: 'resource',
      query: 'x',
      topK: 2,
      maxTokens: 40,
    });
    expect(result.results).toContain('observation group: a');
    expect(result.results).toContain('observation group: c');
    expect(result.results).toContain(
      'Observation groups may be hidden between these results; continue with recall({"mode":"observations","threadId":"thread","groupId":"a","direction":"after"})',
    );
    expect(result.results).not.toMatch(/\d+\+? observation groups hidden/);
  });
  it('keeps the thread ID in gap navigation when a resource-scope search is filtered to one thread', async () => {
    const { memory, om } = setup();
    const call = 'continue with recall({"mode":"observations","threadId":"thread","groupId":"a","direction":"after"})';
    const filtered = await searchMessagesForResource({
      memory,
      om,
      resourceId: 'resource',
      query: 'x',
      topK: 2,
      threadScope: 'thread',
    });
    expect(filtered.results).toContain(call);
    const threadScoped = await searchMessagesForResource({
      memory,
      om,
      resourceId: 'resource',
      query: 'x',
      topK: 2,
      threadScope: 'thread',
      includeThreadId: false,
    });
    expect(threadScoped.results).toContain(
      'continue with recall({"mode":"observations","groupId":"a","direction":"after"})',
    );
  });
  it('attaches record IDs to group IDs so paging can skip the history scan', async () => {
    const { memory, om } = setup();
    const search = memory.searchMessages!;
    memory.searchMessages = async input => ({
      results: (await search(input)).results.map(hit => ({ ...hit, recordId: `record-${hit.groupId}` })),
    });
    const result = await searchMessagesForResource({ memory, om, resourceId: 'resource', query: 'x', topK: 2 });
    expect(result.results).toContain('- observation group: a@record-a\n');
    expect(result.results).not.toContain('- record:');
    expect(result.results).toContain(
      'continue with recall({"mode":"observations","threadId":"thread","groupId":"a@record-a","direction":"after"})',
    );
  });
  it('reads observational memory history at most once per search, however many hits', async () => {
    const { memory, om } = setup();
    const result = await searchMessagesForResource({
      memory,
      om,
      resourceId: 'resource',
      currentThreadId: 'current',
      query: 'x',
      topK: 3,
    });
    expect(result.results).toContain('observation group: a');
    expect(result.results).not.toContain('already in current context');
    expect(vi.mocked(om.getHistory)).toHaveBeenCalledTimes(1);
  });
  it('does not add truncation guidance when every hit fits', async () => {
    const { memory } = setup();
    const result = await searchMessagesForResource({ memory, resourceId: 'resource', query: 'x' });
    expect(result.count).toBe(3);
    expect(result.results).not.toContain('truncated');
  });
  it('exposes observation paging and date filters in both retrieval scopes', () => {
    for (const retrievalScope of ['resource', 'thread'] as const) {
      const tool = recallTool(undefined, { retrievalScope });
      const schema = standardSchemaToJSONSchema(tool.inputSchema) as {
        properties: Record<string, { enum?: string[]; description?: string }>;
      };
      expect(schema.properties.mode.enum).toContain('observations');
      expect(schema.properties.before.description).toContain('search');
      expect(schema.properties.after.description).toContain('search');
      expect(schema.properties.direction.description).toContain('full anchor');
    }
  });
  it('routes paging through the tool with multiple complete groups and correct continuation scope', async () => {
    const { memory, om } = setup();
    const tool = recallTool(undefined, { getOMEngine: () => om });
    const result = (await tool.execute?.({ mode: 'observations', groupId: 'a', limit: 2 }, {
      memory,
      agent: { threadId: 'thread', resourceId: 'resource' },
    } as any)) as any;
    expect(result.count).toBe(2);
    expect(result.hasMore).toBe(true);
    expect(result.results).toContain('Thread: History\n');
    expect(result.results).toContain('Showing 2 groups starting at `a` (oldest first)');
    expect(result.results).toContain('## Group `a`');
    expect(result.results).toContain('## Group `b`');
    expect(result.results).not.toContain('"threadId"');
    expect(result.results).toContain('"groupId":"b@record","direction":"after"');
  });
  it('labels an untitled thread the same way search results do', async () => {
    const { memory, om } = setup();
    vi.mocked(memory.getThreadById!).mockResolvedValueOnce({ ...thread, title: '' });
    const tool = recallTool(undefined, { getOMEngine: () => om });
    const result = (await tool.execute?.({ mode: 'observations', groupId: 'a', limit: 1 }, {
      memory,
      agent: { threadId: 'thread', resourceId: 'resource' },
    } as any)) as any;
    expect(result.results).toContain('Thread: (untitled)\n');
    expect(result.results).not.toContain('Thread: ""');
  });
  describe('messages newer than the last observation', () => {
    const endAt = new Date('2024-01-03T12:00:00Z');
    const withTail = (total: number) => {
      const { memory, om } = setup();
      const end = {
        id: 'c-end',
        threadId: 'thread',
        resourceId: 'resource',
        role: 'user',
        createdAt: endAt,
        content: { format: 2, parts: [] },
      };
      memory.getMemoryStore = async () => ({
        listMessagesById: async ({ messageIds }) => ({ messages: messageIds.includes('c-end') ? [end as never] : [] }),
      });
      const recall = vi.fn(async (_args: Parameters<RecallMemory['recall']>[0]) => ({
        messages: [],
        total,
        page: 0,
        perPage: 1,
        hasMore: false,
      }));
      memory.recall = recall;
      const tool = recallTool(undefined, { getOMEngine: () => om });
      const page = async (args: Record<string, unknown>) =>
        (
          (await tool.execute?.(
            { mode: 'observations', ...args } as any,
            {
              memory,
              agent: { threadId: 'thread', resourceId: 'resource' },
            } as any,
          )) as any
        ).results as string;
      return { page, recall };
    };

    it('points to unobserved messages when paging reaches the end of observations', async () => {
      const { page, recall } = withTail(3);
      const results = await page({ groupId: 'b', limit: 5 });
      expect(results).toContain('## Group `c`');
      expect(results).toContain(
        '— End of observation history for this thread. 3 newer messages have not been observed yet; read them with recall({"mode":"messages","cursor":"c-end"}) —',
      );
      expect(recall).toHaveBeenCalledWith(
        expect.objectContaining({ threadId: 'thread', filter: { dateRange: { start: endAt, startExclusive: true } } }),
      );
    });

    it('points to unobserved messages from an empty later page', async () => {
      const { page } = withTail(1);
      const results = await page({ groupId: 'c', direction: 'after' });
      expect(results).toContain('No later original observation groups');
      expect(results).toContain(
        '1 newer message has not been observed yet; read it with recall({"mode":"messages","cursor":"c-end"})',
      );
    });

    it('keeps the plain end marker when every message is observed', async () => {
      const { page } = withTail(0);
      const results = await page({ groupId: 'b', limit: 5 });
      expect(results).toContain('— End of retained observation history for this thread. —');
      expect(results).not.toContain('newer message');
    });
  });
  it('rejects a cross-resource thread before fetching observations', async () => {
    const { memory, om } = setup();
    const tool = recallTool(undefined, { retrievalScope: 'resource', getOMEngine: () => om });
    await expect(
      tool.execute?.({ mode: 'observations', threadId: 'thread', groupId: 'a' }, {
        memory,
        agent: { threadId: 'other', resourceId: 'other-resource' },
      } as any),
    ).rejects.toThrow('Thread not found');
    expect(om.getHistory).not.toHaveBeenCalled();
  });
  it('does not bypass thread scope with an explicit sibling thread', async () => {
    const { memory, om } = setup();
    const tool = recallTool(undefined, { retrievalScope: 'thread', getOMEngine: () => om });
    await expect(
      tool.execute?.({ mode: 'observations', threadId: 'thread', groupId: 'a' }, {
        memory,
        agent: { threadId: 'other', resourceId: 'resource' },
      } as any),
    ).rejects.toThrow('Thread not found');
    expect(om.getHistory).not.toHaveBeenCalled();
  });
  it('fails closed on old adapters rather than fetching unfiltered history', async () => {
    const storage = new InMemoryStore();
    const store = (await storage.getStore('memory'))!;
    vi.spyOn(store, 'getObservationalMemoryHistory');
    Object.defineProperty(store, 'supportsObservationalMemoryHistorySearch', { value: false });
    const memory = new Memory({
      storage,
      vector: {} as any,
      embedder: {} as any,
      options: { observationalMemory: { model: 'test-model', retrieval: { vector: true } } },
    });
    const result = (await memory.listTools().recall.execute?.({ mode: 'observations', groupId: 'a' }, {
      memory,
      agent: { threadId: 'thread', resourceId: 'resource' },
    } as any)) as any;
    expect(result.count).toBe(0);
    expect(result.results).toContain('storage adapter');
    expect(store.getObservationalMemoryHistory).not.toHaveBeenCalled();
  });
  it('reads the record named in a group ID instead of scanning the history', async () => {
    const { memory, om } = setup();
    const tool = recallTool(undefined, {
      retrievalScope: 'thread',
      searchEnabled: true,
      getOMEngine: async () => om as never,
    });
    const result = (await tool.execute!(
      { mode: 'observations', groupId: 'b@record' } as never,
      { memory, agent: { threadId: 'thread', resourceId: 'resource' } } as never,
    )) as { results: string };
    expect(result.results).toContain('## Group `b`');
    expect(om.getHistory).toHaveBeenNthCalledWith(1, 'thread', 'resource', 1, { recordId: 'record', groupId: 'b' });
  });
});
