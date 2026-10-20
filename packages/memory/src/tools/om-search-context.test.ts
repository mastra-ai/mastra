import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';
import { Memory } from '../index';
import { recallTool, searchMessagesForResource } from './om-tools';
import type { RecallMemory, RecallSearchResult } from './om-tools';

const threadId = 'thread';
const resourceId = 'resource';
function message(id: string, seconds = 0): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    createdAt: new Date(1700000000000 + seconds * 1000),
    content: { format: 2, parts: [{ type: 'text', text: `Message ${id}` }] },
  };
}
function resultMessage(result: unknown): MastraDBMessage {
  return {
    ...message('recall-result'),
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: 'previous-search',
            toolName: 'recall',
            state: 'result',
            args: { mode: 'search', query: 'earlier' },
            result,
          },
        },
      ],
    },
  };
}
function setup(hits: RecallSearchResult[], source: MastraDBMessage[] = []) {
  const memory: RecallMemory = {
    getMemoryStore: async () => ({ listMessagesById: async () => ({ messages: source }) }),
    recall: vi.fn(async () => ({
      messages: source,
      total: source.length,
      page: 0,
      perPage: source.length + 1,
      hasMore: false,
    })),
    listThreads: async () => ({ threads: [], total: 0, hasMore: false, page: 0 }),
    searchMessages: vi.fn(async () => ({ results: hits })),
  };
  const search = (currentMessages: MastraDBMessage[] = [], maxTokens = 100) =>
    searchMessagesForResource({ memory, resourceId, query: 'topic', currentMessages, maxTokens });
  return { memory, search };
}
const hit = (groupId: string, text: string, range?: string): RecallSearchResult => ({
  threadId,
  groupId,
  text,
  range,
  score: 1,
});
const excerpts = (text: string) => [...text.matchAll(/```text\n([\s\S]*?)\n```/g)].map(match => match[1]!);

describe('execution-time recall search context', () => {
  describe('groups already in the current observational memory', () => {
    const group = (id: string, text: string) =>
      `<observation-group id="${id}" range="start-${id}:end-${id}">\n${text}\n</observation-group>`;
    const searchWithRecord = async (record: {
      activeObservations: string;
      bufferedObservationChunks?: { observations: string }[];
    }) => {
      const { memory } = setup([
        hit('active', 'active text'),
        hit('buffered', 'buffered text'),
        hit('old', 'old text'),
      ]);
      const getHistory = vi.fn(async (_threadId: string, _resourceId: string, _limit?: number, options?: object) =>
        options && 'groupId' in options
          ? []
          : [{ id: 'current', generationCount: 3, observedTimezone: null, threadId, ...record }],
      );
      const result = await searchMessagesForResource({
        memory,
        om: { getHistory } as never,
        resourceId,
        currentThreadId: threadId,
        query: 'topic',
        currentMessages: [],
      });
      return { result, getHistory };
    };

    it('compacts groups in active observations or unactivated buffered chunks, not reflected ones', async () => {
      const { result, getHistory } = await searchWithRecord({
        activeObservations: `<observation-group id="reflection" range="a:b" kind="reflection">\nsummary\n</observation-group>\n${group('active', 'active text')}`,
        bufferedObservationChunks: [{ observations: group('buffered', 'buffered text') }],
      });
      expect(excerpts(result.results)).toEqual(['old text']);
      expect(result.results.match(/Group already in current context\./g)).toHaveLength(2);
      expect(getHistory).toHaveBeenCalledWith(threadId, resourceId, 1);
      expect(getHistory.mock.calls.filter(call => call.length === 3 || !call[3])).toHaveLength(1);
    });

    it.each([
      ['an empty object', {}],
      [
        'a JSON string',
        JSON.stringify([
          { observations: '<observation-group id="buffered" range="a:b">\nbuffered text\n</observation-group>' },
        ]),
      ],
    ])('reads buffered chunks stored as %s', async (_label, stored) => {
      const { result } = await searchWithRecord({
        activeObservations: group('active', 'active text'),
        bufferedObservationChunks: stored as never,
      });
      expect(excerpts(result.results)).toEqual(
        typeof stored === 'string' ? ['old text'] : ['buffered text', 'old text'],
      );
    });

    it('keeps excerpts when the current record holds none of the hits', async () => {
      const { result } = await searchWithRecord({ activeObservations: group('other', 'other text') });
      expect(excerpts(result.results)).toEqual(['active text', 'buffered text', 'old text']);
      expect(result.results).not.toContain('Group already in current context');
    });
  });

  it('backfills covered hits with the next ranked groups and keeps compact references', async () => {
    const known = [hit('a', 'known A'), hit('b', 'known B')];
    const previous = await setup(known).search();
    const hits = [
      ...known,
      { ...hit('c', 'fresh C '.repeat(500)), observedAt: new Date('2024-02-02') },
      { ...hit('d', 'fresh D '.repeat(500)), observedAt: new Date('2024-02-01') },
      hit('e', 'lower ranked'),
    ];
    const { memory } = setup(hits);
    memory.searchMessages = vi.fn(async ({ topK }) => ({ results: hits.slice(0, topK) }));
    const result = await searchMessagesForResource({
      memory,
      resourceId,
      query: 'topic',
      topK: 2,
      maxTokens: 100,
      currentMessages: [resultMessage(previous)],
    });
    expect(vi.mocked(memory.searchMessages!).mock.calls.map(([args]) => args.topK)).toEqual([2, 10]);
    expect(result.count).toBe(4);
    expect(result.results.match(/Excerpt already in current context/g)).toHaveLength(2);
    expect(excerpts(result.results)).toHaveLength(2);
    expect(result.results).toContain('Showing 2 excerpts and 2 already-in-context references');
    expect(result.results).not.toContain('lower ranked');
    expect(result.results.indexOf('observation group: d')).toBeLessThan(result.results.indexOf('observation group: c'));
    expect(excerpts(result.results).reduce((sum, text) => sum + estimateTokenCount(text), 0)).toBeLessThanOrEqual(100);
  });

  it('uses already-fetched candidates before another query and assigns spare tokens by relevance', async () => {
    const known = hit('known', 'already visible');
    const previous = await setup([known]).search();
    const hits = [
      hit('high', 'highest evidence '.repeat(500)),
      hit('short', 'brief'),
      known,
      hit('lower', 'lower evidence '.repeat(500)),
      hit('unused', 'not selected'),
    ];
    const { memory } = setup(hits);
    const result = await searchMessagesForResource({
      memory,
      resourceId,
      query: 'topic',
      threadScope: threadId,
      topK: 3,
      maxTokens: 300,
      currentMessages: [resultMessage(previous)],
    });
    expect(memory.searchMessages).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(4);
    const text = excerpts(result.results);
    expect(text).toHaveLength(3);
    expect(estimateTokenCount(text[0]!)).toBeGreaterThan(100);
    expect(text[1]).toBe('brief');
    expect(estimateTokenCount(text[2]!)).toBeLessThanOrEqual(100);
    expect(text.reduce((sum, value) => sum + estimateTokenCount(value), 0)).toBeLessThanOrEqual(300);
    expect(result.results).not.toContain('not selected');
  });

  it('reserves useful excerpt space for backfill when a short initial pool already spent the allowance', async () => {
    const known = hit('known', 'old');
    const fresh = Array.from({ length: 10 }, (_, i) => hit(`fresh-${i}`, `evidence${i} `.repeat(5000)));
    const previous = await setup([known]).search();
    const { memory } = setup([]);
    memory.searchMessages = vi.fn(async ({ topK }) => ({
      results: topK === 10 ? [known, fresh[0]!] : [known, ...fresh],
    }));
    const result = await searchMessagesForResource({
      memory,
      resourceId,
      query: 'topic',
      currentMessages: [resultMessage(previous)],
    });
    const text = excerpts(result.results);
    expect(result.count).toBe(11);
    expect(text).toHaveLength(10);
    expect(text.every(value => estimateTokenCount(value) >= 100)).toBe(true);
    expect(text.reduce((sum, value) => sum + estimateTokenCount(value), 0)).toBeLessThanOrEqual(2000);
  });

  it.each([10, 20])('bounds backfill at five times limit=%s even when every candidate is covered', async topK => {
    const hits = Array.from({ length: 120 }, (_, i) => hit(`known-${i}`, `known evidence ${i}`));
    const current = await Promise.all(hits.map(async value => resultMessage(await setup([value]).search())));
    const { memory } = setup(hits);
    memory.searchMessages = vi.fn(async ({ topK }) => ({ results: hits.slice(0, topK) }));
    const result = await searchMessagesForResource({
      memory,
      resourceId,
      query: 'topic',
      topK,
      currentMessages: current,
    });
    expect(vi.mocked(memory.searchMessages!).mock.calls.map(([args]) => args.topK)).toEqual([topK, topK * 5]);
    expect(result.count).toBe(topK * 5);
    expect(excerpts(result.results)).toEqual([]);
    expect(result.results).toContain('Backfill is bounded; fewer excerpts do not mean history is exhausted.');
  });

  it('backfills a range still in context while preserving thread and date filters', async () => {
    const source = [message('start'), message('end', 1)];
    const date = new Date('2024-01-02');
    const known = { ...hit('known', 'summary', 'start:end'), observedAt: date };
    const fresh = { ...hit('fresh', 'new evidence'), observedAt: date };
    const { memory } = setup([known], source);
    memory.searchMessages = vi.fn(async ({ topK }) => ({
      results:
        topK === 20
          ? [known]
          : [
              known,
              { ...fresh, groupId: 'wrong-thread', threadId: 'other' },
              { ...fresh, groupId: 'wrong-date', observedAt: new Date('2025-01-01') },
              fresh,
            ],
    }));
    const result = await searchMessagesForResource({
      memory,
      resourceId,
      query: 'topic',
      threadScope: threadId,
      after: '2024-01-01',
      before: '2024-02-01',
      currentMessages: source,
    });
    expect(memory.recall).not.toHaveBeenCalled();
    expect(result.count).toBe(2);
    expect(result.results).toContain('Source range overlaps current context');
    expect(excerpts(result.results)).toEqual(['new evidence']);
    expect(result.results).not.toContain('wrong-thread');
    expect(result.results).not.toContain('wrong-date');
    expect(memory.searchMessages).toHaveBeenLastCalledWith({
      query: 'topic',
      resourceId,
      topK: 50,
      filter: { threadId, observedAfter: new Date('2024-01-01'), observedBefore: new Date('2024-02-01') },
    });
  });

  it('does not fetch deeper candidates when no evidence is already covered', async () => {
    const { search, memory } = setup([hit('a', 'fresh evidence')]);
    await search([message('unrelated')]);
    expect(memory.searchMessages).toHaveBeenCalledTimes(1);
  });

  it('recognizes earlier results whose group IDs carry a record ID', async () => {
    const a = { ...hit('a', 'previous evidence'), recordId: 'record-1' };
    const previous = await setup([a]).search();
    expect(previous.results).toContain('observation group: a@record-1\n');
    const compact = await setup([a]).search([resultMessage(previous)]);
    expect(compact.results).toContain(
      'observation group: a@record-1\n  thread: thread; Excerpt already in current context.',
    );
  });
  it('compacts identical excerpts and spends the reclaimed allowance on fresh hits', async () => {
    const a = hit('a', 'previous evidence '.repeat(500));
    const b = hit('b', 'new evidence '.repeat(500));
    const first = setup([a]);
    const previous = await first.search([], 50);
    const { search } = setup([a, b]);
    const full = await search();
    const compact = await search([resultMessage(previous)]);
    expect(compact.count).toBe(2);
    expect(compact.results).toContain('observation group: a\n  thread: thread; Excerpt already in current context.');
    expect(excerpts(compact.results)).toHaveLength(1);
    expect(estimateTokenCount(excerpts(compact.results)[0]!)).toBeGreaterThan(
      estimateTokenCount(excerpts(full.results)[1]!),
    );
    expect(excerpts(compact.results).reduce((sum, text) => sum + estimateTokenCount(text), 0)).toBeLessThanOrEqual(100);
  });

  it('PR #25961 consumer proof: search dedupe null falls back to raw result', async () => {
    const { search } = setup([hit('a', 'previous evidence')]);
    const previous = await search();
    const expected = await search([resultMessage(previous)]);
    const current = resultMessage(previous);
    const part = current.content.parts[0]!;
    if (part.type !== 'tool-invocation') throw new Error('Expected a tool invocation');
    part.providerMetadata = { mastra: { modelOutput: null } };
    const original = structuredClone(current);

    const compact = await search([current]);

    expect(compact.results, 'PR25961_SEARCH_DEDUPE_NULL_RAW_FALLBACK').toContain(
      'observation group: a\n  thread: thread; Excerpt already in current context.',
    );
    expect(compact).toEqual(expected);
    expect(excerpts(compact.results)).toEqual([]);
    expect(current).toEqual(original);
  });

  it('returns compact references for all repeats, then expands again after the original results leave context', async () => {
    const { search } = setup([hit('a', 'Same evidence')]);
    const initial = await search();
    const compact = await search([resultMessage(initial)]);
    expect(compact.count).toBe(1);
    expect(excerpts(compact.results)).toEqual([]);
    expect(compact.results).not.toContain('truncated');
    expect((await search([resultMessage(compact)])).results).toBe(initial.results);
    expect((await search()).results).toBe(initial.results);
  });

  it.each(['longer', 'different', 'other-thread'] as const)(
    'keeps %s evidence for a previously seen group ID',
    async kind => {
      const { search } = setup([hit('a', 'first fragment '.repeat(300))]);
      const previous = await search([], 30);
      const next = hit('a', kind === 'different' ? 'another chunk of this group' : 'first fragment '.repeat(300));
      if (kind === 'other-thread') next.threadId = 'sibling';
      const result = await setup([next]).search([resultMessage(previous)], 100);
      expect(result.results).not.toContain('already in current context');
      expect(excerpts(result.results)).toHaveLength(1);
    },
  );

  it.each(['quoted', 'other-tool', 'custom-output'] as const)(
    'does not suppress against %s search-looking text',
    async kind => {
      const { search } = setup([hit('a', 'evidence')]);
      const previous = await search();
      const current = resultMessage(previous);
      const part = current.content.parts[0]!;
      if (kind === 'quoted') current.content.parts = [{ type: 'text', text: previous.results }];
      if (part.type === 'tool-invocation') {
        if (kind === 'other-tool') part.toolInvocation.toolName = 'other';
        if (kind === 'custom-output')
          part.providerMetadata = { mastra: { modelOutput: { type: 'text', value: 'hidden' } } };
      }
      expect((await search([current])).results).toBe(previous.results);
    },
  );

  it('recognizes a JSON model output that still contains the excerpt', async () => {
    const { search } = setup([hit('a', 'evidence')]);
    const previous = await search();
    const current = resultMessage({ results: 'not the model output' });
    current.content.parts[0]!.providerMetadata = { mastra: { modelOutput: { type: 'json', value: previous } } };
    expect((await search([current])).results).toContain('Excerpt already in current context');
  });

  it('compacts a source range when both endpoints are visible, without storage reads', async () => {
    const { search, memory } = setup([hit('a', 'summary', 'start:end')]);
    const current = [message('start'), message('end', 1)];
    const original = structuredClone(current);
    const result = await search(current);
    expect(excerpts(result.results)).toEqual([]);
    expect(result.results).toContain('Source range overlaps current context.');
    expect(memory.recall).not.toHaveBeenCalled();
    expect(current).toEqual(original);
    expect(excerpts((await search()).results)).toEqual(['summary']);
  });

  // A lone endpoint is a message kept back after its group left context, such as a tool call awaiting its result.
  it.each(['start', 'end'])('keeps the excerpt when only its %s endpoint is visible', async endpoint => {
    const { search, memory } = setup([hit('a', 'summary', 'start:end')]);
    const result = await search([message(endpoint)]);
    expect(excerpts(result.results)).toEqual(['summary']);
    expect(result.results).not.toContain('Source range overlaps current context');
    expect(memory.recall).not.toHaveBeenCalled();
  });

  it.each(['complete', 'missing-middle', 'trimmed-parts'] as const)(
    'uses endpoint identity rather than stored content: %s',
    async kind => {
      const current = [message('start'), message('middle', 1), message('end', 2)];
      if (kind === 'missing-middle') current.splice(1, 1);
      if (kind === 'trimmed-parts') current[0]!.content.parts = [{ type: 'text', text: 'changed' }];
      const { search, memory } = setup([hit('a', 'summary', 'start:end')]);
      expect(excerpts((await search(current)).results)).toEqual([]);
      expect(memory.recall).not.toHaveBeenCalled();
    },
  );

  it.each(['wrong-thread', 'middle-only', 'empty', 'bad-range', 'missing-range', 'missing-group'] as const)(
    'keeps the excerpt without a matching endpoint: %s',
    async kind => {
      const current = kind === 'empty' ? [] : [message(kind === 'middle-only' ? 'middle' : 'start')];
      if (kind === 'wrong-thread') current[0]!.threadId = 'other';
      const match = hit('a', 'summary', kind === 'bad-range' ? 'start:end:extra' : 'start:end');
      if (kind === 'missing-range') delete match.range;
      if (kind === 'missing-group') delete match.groupId;
      const { search, memory } = setup([match]);
      expect(excerpts((await search(current)).results)).toEqual(['summary']);
      expect(memory.recall).not.toHaveBeenCalled();
    },
  );

  it('suppresses stored source groups by endpoints without reading message history', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const source = [message('start'), message('middle', 1), message('end', 2)];
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Source coverage',
        createdAt: source[0]!.createdAt,
        updatedAt: source[2]!.createdAt,
      },
    });
    await memory.saveMessages({ messages: source });
    vi.spyOn(memory, 'searchMessages').mockResolvedValue({ results: [hit('a', 'summary', 'start:end')] });
    const recall = vi.spyOn(memory, 'recall');
    const complete = await searchMessagesForResource({ memory, resourceId, query: 'topic', currentMessages: source });
    expect(complete.results).toContain('Source range overlaps current context');
    const partial = await searchMessagesForResource({
      memory,
      resourceId,
      query: 'topic',
      currentMessages: [source[0]!, source[2]!],
    });
    expect(partial.results).toContain('Source range overlaps current context');
    expect(recall).not.toHaveBeenCalled();
  });

  it('handles a single-message range with later appended parts and non-visible OM markers', async () => {
    const source = [message('one')];
    const current = structuredClone(source);
    current[0]!.content.parts.push({ type: 'text', text: 'More recent content' });
    source[0]!.content.parts.push({ type: 'data-om-observation', data: { observed: true } });
    const { search } = setup([hit('a', 'summary', 'one:one')], source);
    expect((await search(current)).results).toContain('Source range overlaps current context');
  });

  it('routes the live getter through recall.execute without using the input-only messages field', async () => {
    const { search, memory } = setup([hit('a', 'evidence')]);
    const previous = await search();
    const getMessages = vi.fn(() => [resultMessage(previous)]);
    const context = {
      memory,
      agent: {
        agentId: 'agent',
        toolCallId: 'call',
        threadId,
        resourceId,
        messages: [],
        getMessages,
        suspend: vi.fn(),
      },
    };
    const tool = recallTool();
    const result = await tool.execute?.({ mode: 'search', query: 'topic' }, context);
    expect(result).toEqual(
      expect.objectContaining({ results: expect.stringContaining('Excerpt already in current context') }),
    );
    expect(getMessages).toHaveBeenCalledTimes(1);
    getMessages.mockReturnValue([]);
    const next = await tool.execute?.({ mode: 'search', query: 'topic' }, context);
    expect(next).toEqual(expect.objectContaining({ results: expect.stringContaining('```text\nevidence\n```') }));
  });
});

describe('query-relevant search excerpts', () => {
  const filler = Array.from(
    { length: 12 },
    (_, i) => `* 🟡 (15:${String(10 + i).padStart(2, '0')}) User asked about memory spikes and gc tuning step ${i}.`,
  ).join(' ');
  const group = hit(
    'g',
    `Date: Jan 22, 2025 * 🟡 (09:00) Earlier day note. Date: Jan 23, 2025 ${filler} ` +
      `* 🔴 (16:09) User debugging 'state overload' warning while scaling to 45 agents concurrently. ` +
      `* 🟡 (16:20) User asked about log rotation.`,
  );
  const searchFor = (query: string, currentMessages: MastraDBMessage[] = [], maxTokens = 60) => {
    const { memory } = setup([group]);
    return searchMessagesForResource({ memory, resourceId, query, currentMessages, maxTokens });
  };

  it('starts a truncated excerpt at the line that matches the query, keeping its date', async () => {
    const result = await searchFor("'state overload' warning agents");
    const [excerpt] = excerpts(result.results);
    expect(excerpt).toMatch(
      /^Date: Jan 23, 2025 \[earlier lines omitted\] \* 🔴 \(16:09\) User debugging 'state overload'/,
    );
    expect(excerpt).toContain('45 agents');
    expect(estimateTokenCount(excerpt!)).toBeLessThanOrEqual(60);
    expect(result.results).toContain('[Excerpt truncated]');
  });

  it('keeps the head of the text when no line matches the query', async () => {
    const [excerpt] = excerpts((await searchFor('unrelated topic')).results);
    expect(excerpt).toMatch(/^Date: Jan 22, 2025 \* 🟡 \(09:00\) Earlier day note\./);
  });

  it('shows the unseen matching line even when the head of the group is already in context', async () => {
    const head = await searchFor('unrelated topic');
    const result = await searchFor('state overload', [resultMessage(head)]);
    expect(result.results).not.toContain('already in current context');
    expect(excerpts(result.results)[0]).toContain("'state overload' warning");
  });

  it('compacts a matching excerpt when the whole group was already shown', async () => {
    const full = await searchFor('unrelated topic', [], 2000);
    expect(excerpts(full.results)[0]).toBe(group.text);
    const result = await searchFor('state overload', [resultMessage(full)]);
    expect(result.results).toContain('Excerpt already in current context');
  });
});
