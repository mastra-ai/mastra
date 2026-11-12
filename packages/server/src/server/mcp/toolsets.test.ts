import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import type { ServerMCPConfig } from '@mastra/core/server';
import { InMemoryStore, MastraCompositeStore, ObservabilityStorage } from '@mastra/core/storage';
import type { MastraStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { buildBuiltinMCPTools } from './catalogue';
import { resolveBuiltinMCPConfig } from './config';
import { MAX_RESULT_CHARS } from './result-size';
import { BUILTIN_MCP_HTTP_ROUTE } from './route';

const NEW_TOOLSETS = ['memory', 'observability', 'observability_analytics', 'stored_agents'] as const;

function setup({
  mcp = {},
  memory = true,
  agentIds = ['helper'],
  store = new InMemoryStore(),
}: {
  mcp?: ServerMCPConfig;
  memory?: boolean;
  agentIds?: string[];
  store?: MastraStorage;
}) {
  const agent = (id: string) =>
    new Agent({
      id,
      name: id,
      instructions: 'test',
      model: 'openai/gpt-4o-mini',
      ...(memory ? { memory: new MockMemory({ storage: store as InMemoryStore }) } : {}),
    });
  const mastra = new Mastra({
    logger: false,
    storage: store,
    agents: Object.fromEntries(agentIds.map(id => [id, agent(id)])),
    server: { mcp },
  });
  return (query = '') =>
    buildBuiltinMCPTools(
      {
        mastra,
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
        mcpRoute: BUILTIN_MCP_HTTP_ROUTE,
      },
      resolveBuiltinMCPConfig(mastra, new Request(`http://localhost/api/mcp${query}`)),
    );
}

const names = (tools: Record<string, unknown>) => Object.keys(tools).sort();
const jsonSchemaOf = (tool: { inputSchema?: unknown }) => {
  const input = tool.inputSchema as any;
  return input?.jsonSchema ?? input?.['~standard']?.jsonSchema?.input?.({ target: 'draft-07' }) ?? input;
};

describe('built-in MCP memory and observability toolsets', () => {
  it('offers exactly the planned memory tools', async () => {
    const tools = await setup({ mcp: { toolsets: ['memory'] } })();
    expect(names(tools)).toEqual([
      'clone_thread',
      'create_thread',
      'get_memory_status',
      'get_observations',
      'get_thread',
      'list_messages',
      'list_threads',
      'save_messages',
      'search_memory',
      'update_thread',
    ]);
    expect(Object.keys(jsonSchemaOf(tools.get_observations!).properties)).toContain('waitForPending');
  });

  it('offers list_traces (not query_traces) and the analytics the in-memory store supports', async () => {
    const build = setup({ mcp: { toolsets: ['observability', 'observability_analytics'] } });
    const tools = await build();
    expect(names(tools)).toEqual([
      'analyze_feedback',
      'analyze_metrics',
      'analyze_scores',
      'get_span',
      'get_trace',
      'get_trace_trajectory',
      'list_feedback',
      'list_logs',
      'list_metric_names',
      'list_scores',
      'list_traces',
    ]);
  });

  it('hides the memory toolset when no agent has memory', async () => {
    expect(names(await setup({ memory: false, mcp: { toolsets: ['memory'] } })())).toEqual([]);
  });

  it('hides stored_agents without an editor', async () => {
    expect(names(await setup({ mcp: { toolsets: ['stored_agents'] } })())).toEqual([]);
  });

  it('keeps POST observability:read tools in read-only mode and drops memory writes (incl. waiting on observations)', async () => {
    const tools = await setup({ mcp: { toolsets: [...NEW_TOOLSETS] } })('?readonly=1');
    expect(tools.analyze_metrics).toBeDefined();
    expect(tools.list_threads).toBeDefined();
    for (const write of ['create_thread', 'update_thread', 'clone_thread', 'save_messages']) {
      expect(tools[write]).toBeUndefined();
    }
    // The wait runs the memory:write buffer-status route, so read-only mode keeps get_observations without it.
    expect(Object.keys(jsonSchemaOf(tools.get_observations!).properties)).not.toContain('waitForPending');
    for (const tool of Object.values(tools)) expect(tool.mcp?.annotations?.readOnlyHint).toBe(true);
  });

  it('gives every tool a plain object input schema (no top-level combinators)', async () => {
    const tools = await setup({})();
    expect(Object.keys(tools).length).toBeGreaterThan(20);
    for (const [name, tool] of Object.entries(tools)) {
      const schema = jsonSchemaOf(tool);
      expect(schema?.type, name).toBe('object');
      for (const key of ['oneOf', 'anyOf', 'allOf', 'not']) expect(schema, `${name}.${key}`).not.toHaveProperty(key);
    }
  });

  it('rejects analyze_* ops that are not own route keys (e.g. inherited Object.prototype names)', async () => {
    const tools = await setup({ mcp: { toolsets: ['observability_analytics'] } })();
    for (const op of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const result = (await tools.analyze_metrics!.execute!({ op, name: 'x' } as any, {} as any)) as any;
      expect(result, op).toMatchObject({ error: true });
      expect(result.validationErrors.fields.op.errors, op).toEqual(['must be equal to one of the allowed values']);
    }
  });

  it('treats an agent excluded from MCP as not found in the memory tools, with or without an agentId enum', async () => {
    for (const enumLimit of [undefined, 0]) {
      const tools = await setup({
        agentIds: ['helper', 'secret'],
        mcp: {
          toolsets: ['memory'],
          exclude: { agents: ['secret'] },
          ...(enumLimit === undefined ? {} : { enumLimit }),
        },
      })();
      const agentIdSchema = jsonSchemaOf(tools.create_thread!).properties.agentId;
      if (enumLimit === undefined) expect(agentIdSchema.enum).toEqual(['helper']);
      else expect(agentIdSchema.enum).toBeUndefined();

      const thread = (await tools.create_thread!.execute!({ agentId: 'helper', resourceId: 'r1' }, {} as any)) as any;
      expect(thread.id).toEqual(expect.any(String));
      const calls: Array<[string, Record<string, unknown>]> = [
        ['create_thread', { agentId: 'secret', resourceId: 'r1' }],
        ['list_threads', { agentId: 'secret', resourceId: 'r1' }],
        ['get_thread', { agentId: 'secret', threadId: thread.id }],
        ['list_messages', { agentId: 'secret', threadId: thread.id }],
        ['get_observations', { agentId: 'secret', resourceId: 'r1' }],
        ['get_memory_status', { agentId: 'secret', resourceId: 'r1' }],
        ['save_messages', { agentId: 'secret', messages: [] }],
      ];
      for (const [name, args] of calls) {
        const run = tools[name]!.execute!(args as any, {} as any);
        // With an enum the input schema rejects the id; without one (above enumLimit) the call is "not found".
        if (enumLimit === undefined) {
          expect(((await run) as any).validationErrors.fields.agentId.errors, name).toEqual([
            'must be equal to one of the allowed values',
          ]);
        } else {
          await expect(run, name).rejects.toThrow(/404 Agent not found/);
        }
      }
    }
  });

  describe('result size', () => {
    const big = 'x'.repeat(3_000);
    const span = (traceId: string, index: number, parentSpanId: string | null) => ({
      traceId,
      spanId: `span-${String(index).padStart(3, '0')}`,
      parentSpanId,
      name: `step ${index}`,
      spanType: SpanType.MODEL_GENERATION,
      isEvent: false,
      startedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, index)),
      endedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 1, index)),
      model: 'gpt-4o-mini',
      provider: 'openai',
      attributes: { usage: { inputTokens: 10, outputTokens: 5 }, prompt: big },
      input: { messages: [{ role: 'user', content: big }] },
      output: { text: big },
      metadata: { blob: big },
    });

    const records = (traces: number, spansPerTrace: number) =>
      Array.from({ length: traces }, (_, trace) =>
        Array.from({ length: spansPerTrace }, (_, index) =>
          span(`trace-${trace}`, index, index === 0 ? null : 'span-000'),
        ),
      ).flat();
    /** Spans of ~12 kB each: 600 of them are ~7 MB as returned by GET /observability/traces/:traceId. */
    const seed = async (traces: number, spansPerTrace: number) => {
      const store = new InMemoryStore();
      const observability = (await store.getStore('observability'))!;
      await observability.batchCreateSpans({ records: records(traces, spansPerTrace) });
      return Object.assign(await setup({ store, mcp: { toolsets: ['observability'] } })(), { observability });
    };
    const size = (value: unknown) => JSON.stringify(value).length;
    const spanIds = (count: number) =>
      Array.from({ length: count }, (_, index) => `span-${String(index).padStart(3, '0')}`);

    /** Reads a whole trace through get_trace, following nextOffset; every page must fit the cap. */
    const readTrace = async (tools: Record<string, any>, traceId: string) => {
      const pages: any[] = [];
      let offset: number | undefined = 0;
      while (offset !== undefined) {
        const page = await tools.get_trace.execute(offset ? { traceId, offset } : { traceId }, {} as any);
        expect(size(page)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
        if (page.nextOffset !== undefined) {
          expect(page.truncated).toContain('offset');
          expect(page.nextOffset, 'nextOffset must advance').toBeGreaterThan(offset);
        }
        pages.push(page);
        offset = page.nextOffset;
      }
      return { pages, spans: pages.flatMap(page => page.spans) };
    };

    it('get_trace returns light span records, pages a huge trace by offset, and get_span has the full span', async () => {
      const tools = await seed(1, 600);
      const { pages, spans } = await readTrace(tools, 'trace-0');
      // Exactly the store's light trace (what GET /observability/traces/:traceId/light returns), plus status.
      const light = await tools.observability.getTraceLight({ traceId: 'trace-0' });
      expect(spans).toEqual(light!.spans.map(record => ({ ...record, status: 'success' })));
      expect(pages.length).toBeGreaterThan(1);
      expect(pages.every(page => page.spanCount === 600)).toBe(true);
      expect(spans.map(light => light.spanId)).toEqual(spanIds(600));
      for (const light of spans) {
        for (const key of ['input', 'output', 'attributes', 'metadata']) expect(light).not.toHaveProperty(key);
      }
      expect(spans[1]).toMatchObject({
        traceId: 'trace-0',
        spanId: 'span-001',
        parentSpanId: 'span-000',
        spanType: SpanType.MODEL_GENERATION,
        status: 'success',
      });

      const full = (await tools.get_span!.execute!({ traceId: 'trace-0', spanId: 'span-042' }, {} as any)) as any;
      expect(full.span.input).toEqual({ messages: [{ role: 'user', content: big }] });
      expect(full.span.output).toEqual({ text: big });
      expect(full.span.attributes.prompt).toBe(big);
    });

    it('a normal agent trace fits in one get_trace page', async () => {
      const tools = await seed(1, 20);
      const { pages, spans } = await readTrace(tools, 'trace-0');
      expect(pages).toHaveLength(1);
      expect(pages[0]).not.toHaveProperty('truncated');
      expect(spans).toHaveLength(20);
    });

    it('stores without light traces get the same light records from the full trace', async () => {
      /** Like DSQL: implements getTrace and getSpan but neither getTraceLight nor getStructure. */
      class FullTraceOnlyStorage extends ObservabilityStorage {
        constructor(private readonly inner: ObservabilityStorage) {
          super();
        }
        override getTrace(args: Parameters<ObservabilityStorage['getTrace']>[0]) {
          return this.inner.getTrace(args);
        }
        override getSpan(args: Parameters<ObservabilityStorage['getSpan']>[0]) {
          return this.inner.getSpan(args);
        }
      }
      const memory = new InMemoryStore();
      const inner = (await memory.getStore('observability'))!;
      await inner.batchCreateSpans({ records: records(1, 600) });
      const store = new MastraCompositeStore({
        id: 'full-trace-only',
        default: memory,
        domains: { observability: new FullTraceOnlyStorage(inner) },
      });
      const tools = await setup({ store, mcp: { toolsets: ['observability'] } })();

      const { pages, spans } = await readTrace(tools, 'trace-0');
      expect(pages.length).toBeGreaterThan(1);
      expect(spans.map(light => light.spanId)).toEqual(spanIds(600));
      for (const light of spans) {
        for (const key of ['input', 'output', 'attributes']) expect(light).not.toHaveProperty(key);
      }
      expect(spans[1]).toMatchObject({ parentSpanId: 'span-000', status: 'success' });
      const full = (await tools.get_span!.execute!({ traceId: 'trace-0', spanId: 'span-042' }, {} as any)) as any;
      expect(full.span.attributes.prompt).toBe(big);
    });

    it('list_traces keeps its rows under the cap and says how to page', async () => {
      const tools = await seed(60, 1);
      const result = (await tools.list_traces!.execute!({ perPage: 60 } as any, {} as any)) as any;
      expect(size(result)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
      expect(result.spans.length).toBeGreaterThan(0);
      expect(result.spans.length).toBeLessThan(60);
      expect(result.truncated).toContain('perPage');
      expect(result).not.toHaveProperty('pagination');

      const small = (await tools.list_traces!.execute!({ perPage: 2 } as any, {} as any)) as any;
      expect(small.spans).toHaveLength(2);
      expect(small).not.toHaveProperty('truncated');
      expect(small.pagination).toMatchObject({ hasMore: true });
    });

    it('list_logs drops its cursors when the page is cut, so they do not skip the cut logs', async () => {
      const store = new InMemoryStore();
      const observability = (await store.getStore('observability'))!;
      const tools = await setup({ store, mcp: { toolsets: ['observability'] } })();
      const listLogs = async (args: Record<string, unknown>) =>
        (await tools.list_logs!.execute!(args as any, {} as any)) as any;
      // The tool schema doesn't offer delta polling, but the route still accepts it.
      const { deltaCursor: after } = await listLogs({ mode: 'delta' });
      await observability.batchCreateLogs({
        logs: Array.from({ length: 5 }, (_, index) => ({
          logId: `log-${index}`,
          timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
          level: 'info' as const,
          message: `log ${index} ${'l'.repeat(15_000)}`,
        })) as any,
      });

      // pagination would say hasMore: false; deltaCursor would start polling after the cut logs.
      const cut = await listLogs({ perPage: 5 });
      expect(size(cut)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
      expect(cut.logs.length).toBeGreaterThan(0);
      expect(cut.logs.length).toBeLessThan(5);
      expect(cut.truncated).toContain('perPage');
      expect(cut).not.toHaveProperty('pagination');
      expect(cut).not.toHaveProperty('deltaCursor');

      const polled = await listLogs({ mode: 'delta', after, limit: 5 });
      expect(polled.logs.length).toBeGreaterThan(0);
      expect(polled.logs.length).toBeLessThan(5);
      expect(polled).not.toHaveProperty('delta');
      expect(polled).not.toHaveProperty('deltaCursor');

      const whole = await listLogs({ perPage: 1 });
      expect(whole.logs).toHaveLength(1);
      expect(whole.pagination).toMatchObject({ total: 5, hasMore: true });
    });

    const huge = 'h'.repeat(60_000);
    const truncatedMarker = /\[truncated \d+ chars/;

    it('get_trace returns a span too big for one result with its long values clipped, and keeps paging', async () => {
      const store = new InMemoryStore();
      const observability = (await store.getStore('observability'))!;
      const spans = records(1, 3).map((record, index) =>
        index === 1 ? { ...record, name: `step ${huge}`, error: { message: huge } } : record,
      );
      await observability.batchCreateSpans({ records: spans });
      const tools = await setup({ store, mcp: { toolsets: ['observability'] } })();

      const { pages, spans: read } = await readTrace(tools, 'trace-0');
      expect(read.map(light => light.spanId)).toEqual(spanIds(3));
      const big = read[1];
      expect(big.spanId).toBe('span-001');
      expect(big.name).toMatch(truncatedMarker);
      expect(big.error.message).toMatch(truncatedMarker);
      expect(big.error.message).toContain('use get_span for the full value');
      expect(pages.map(page => page.spans.length)).toEqual([1, 1, 1]);

      const full = (await tools.get_span!.execute!({ traceId: 'trace-0', spanId: 'span-001' }, {} as any)) as any;
      expect(full.span.error.message).toBe(huge);
    });

    it('list_messages returns a message too big for one result with its long values clipped; every message pages', async () => {
      const store = new InMemoryStore();
      const tools = await setup({ store, mcp: { toolsets: ['memory'] } })();
      const memoryStore = (await store.getStore('memory'))!;
      const at = (second: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, second));
      await memoryStore.saveThread({
        thread: { id: 't1', resourceId: 'r1', title: '', metadata: {}, createdAt: at(0), updatedAt: at(0) },
      });
      const texts = [huge, 'second', 'third'];
      await memoryStore.saveMessages({
        messages: texts.map((text, index) => ({
          id: `m${index}`,
          threadId: 't1',
          resourceId: 'r1',
          role: 'user' as const,
          createdAt: at(index + 1),
          content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
        })),
      });
      const list = (args: Record<string, unknown>) =>
        tools.list_messages!.execute!({ agentId: 'helper', threadId: 't1', ...args }, {} as any) as Promise<any>;

      const first = await list({});
      expect(size(first)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
      expect(first.messages).toHaveLength(1);
      expect(first.messages[0].id).toBe('m0');
      expect(first.messages[0].content.parts[0].text).toMatch(truncatedMarker);
      expect(first.truncated).toContain('perPage');

      const ids: string[] = [];
      for (let page = 0; page < texts.length; page++) {
        const result = await list({ page, perPage: 1 });
        expect(size(result)).toBeLessThanOrEqual(MAX_RESULT_CHARS);
        ids.push(...result.messages.map((message: { id: string }) => message.id));
      }
      expect(ids).toEqual(['m0', 'm1', 'm2']);
    });
  });
});
