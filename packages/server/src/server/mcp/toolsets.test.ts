import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { SimpleAuth } from '@mastra/core/server';
import type { ServerMCPConfig } from '@mastra/core/server';
import { InMemoryStore, MastraCompositeStore, ObservabilityStorage } from '@mastra/core/storage';
import type { MastraStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../../memory/src/index';
import {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  MASTRA_USER_KEY,
  MASTRA_USER_PERMISSIONS_KEY,
} from '../constants';
import { GET_RESOURCE_WORKING_MEMORY_ROUTE } from '../handlers/memory';
import { createTestServerContext } from '../handlers/test-utils';
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
  requestContext = new RequestContext(),
  workingMemory = false,
  server = {},
}: {
  mcp?: ServerMCPConfig;
  memory?: boolean;
  agentIds?: string[];
  store?: MastraStorage;
  requestContext?: RequestContext;
  workingMemory?: boolean;
  server?: ReturnType<Mastra['getServer']>;
}) {
  const agent = (id: string) =>
    new Agent({
      id,
      name: id,
      instructions: 'test',
      model: 'openai/gpt-4o-mini',
      ...(memory
        ? { memory: new MockMemory({ storage: store as InMemoryStore, enableWorkingMemory: workingMemory }) }
        : {}),
    });
  const mastra = new Mastra({
    logger: false,
    storage: store,
    agents: Object.fromEntries(agentIds.map(id => [id, agent(id)])),
    server: { ...server, mcp },
  });
  return (query = '') =>
    buildBuiltinMCPTools(
      {
        mastra,
        requestContext,
        abortSignal: new AbortController().signal,
        mcpRoute: BUILTIN_MCP_HTTP_ROUTE,
        routePrefix: '/api',
        request: new Request('http://localhost/api/mcp', { headers: { Authorization: 'Bearer test-token' } }),
      },
      resolveBuiltinMCPConfig(mastra, new Request(`http://localhost/api/mcp${query}`)),
    );
}

async function workingMemoryAccess({
  scope = 'resource',
  serverFga,
  studioFga,
  authMode,
  pinnedThread,
}: {
  scope?: 'resource' | 'thread';
  serverFga?: NonNullable<ReturnType<Mastra['getServer']>>['fga'];
  studioFga?: NonNullable<ReturnType<Mastra['getServer']>>['fga'];
  authMode?: 'server' | 'studio';
  pinnedThread?: string;
} = {}) {
  const withRequire = (provider: NonNullable<NonNullable<ReturnType<Mastra['getServer']>>['fga']>) => ({
    ...provider,
    require: async (...args: Parameters<typeof provider.check>) => {
      if (!(await provider.check(...args))) throw new Error('403 FGA policy denied access');
    },
  });
  const store = new InMemoryStore();
  const memory = new Memory({ storage: store, options: { workingMemory: { enabled: true, scope } } });
  const user = { id: 'u1', role: 'admin' };
  const mastra = new Mastra({
    logger: false,
    storage: store,
    agents: {
      helper: new Agent({ id: 'helper', name: 'helper', instructions: 'test', model: 'openai/gpt-4o-mini', memory }),
    },
    server: {
      auth: new SimpleAuth({ tokens: { 'test-token': user } }),
      rbac: { getRoles: async () => [], getPermissions: async () => ['*'] },
      mcp: { toolsets: ['memory'] },
      ...(serverFga ? { fga: withRequire(serverFga) } : {}),
    },
    ...(studioFga ? { studio: { fga: withRequire(studioFga) } } : {}),
  });
  const context = new RequestContext();
  context.set(MASTRA_RESOURCE_ID_KEY, 'r1');
  context.set(MASTRA_USER_KEY, user);
  context.set('user', user);
  context.set(MASTRA_USER_PERMISSIONS_KEY, ['mcp:execute', 'memory:read', 'agents:read']);
  if (authMode) context.set(MASTRA_AUTH_MODE_KEY, authMode);
  if (pinnedThread) context.set(MASTRA_THREAD_ID_KEY, pinnedThread);
  const db = (await store.getStore('memory'))!;
  const now = new Date('2026-01-01T00:00:00Z');
  await db.saveResource({ resource: { id: 'r1', workingMemory: 'RESOURCE MEMO', createdAt: now, updatedAt: now } });
  await db.saveResource({ resource: { id: 'r2', workingMemory: 'OTHER OWNER', createdAt: now, updatedAt: now } });
  await db.saveThread({
    thread: {
      id: 't1',
      resourceId: 'r1',
      title: '',
      metadata: { workingMemory: 'THREAD MEMO' },
      createdAt: now,
      updatedAt: now,
    },
  });
  await db.saveThread({
    thread: {
      id: 't2',
      resourceId: 'r2',
      title: '',
      metadata: { workingMemory: 'OTHER THREAD' },
      createdAt: now,
      updatedAt: now,
    },
  });
  const tools = await buildBuiltinMCPTools(
    {
      mastra,
      requestContext: context,
      abortSignal: new AbortController().signal,
      mcpRoute: BUILTIN_MCP_HTTP_ROUTE,
      routePrefix: '/api',
      request: new Request('http://localhost/api/mcp', { headers: { Authorization: 'Bearer test-token' } }),
    },
    resolveBuiltinMCPConfig(mastra, new Request('http://localhost/api/mcp?readonly=1')),
  );
  return {
    db,
    context,
    user,
    read: (args: Record<string, unknown> = {}) =>
      tools.get_working_memory!.execute!({ agentId: 'helper', ...args }, {} as any),
    handlerRead: (args: { resourceId?: string; requestContext?: RequestContext } = {}) =>
      GET_RESOURCE_WORKING_MEMORY_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        agentId: 'helper',
        requestContext: context,
        resourceId: 'r1',
        ...args,
      }),
  };
}

const names = (tools: Record<string, unknown>) => Object.keys(tools).sort();
const jsonSchemaOf = (tool: { inputSchema?: unknown }) => {
  const input = tool.inputSchema as any;
  return input?.jsonSchema ?? input?.['~standard']?.jsonSchema?.input?.({ target: 'draft-07' }) ?? input;
};

describe('working-memory inspection authorization', () => {
  it('does not let resource-only reads bypass a thread FGA denial', async () => {
    const access = await workingMemoryAccess({ serverFga: { check: async () => false } });
    await expect(access.read({ threadId: 't1' })).rejects.toThrow(/403/);
    await expect(access.read()).rejects.toThrow(/403/);
  });

  it('authorizes the context-owned resource, not the caller-supplied resource or a thread grant', async () => {
    const access = await workingMemoryAccess({
      serverFga: {
        check: async (_user, { resource, permission }) =>
          resource.type === 'resource' && resource.id === 'r1' && permission === 'memory:read',
      },
    });
    const before = await access.db.getResourceById({ resourceId: 'r1' });
    expect(await access.read({ resourceId: 'r2' })).toMatchObject({
      workingMemory: 'RESOURCE MEMO',
      source: 'resource',
    });
    expect(await access.handlerRead({ resourceId: 'r2' })).toMatchObject({
      workingMemory: 'RESOURCE MEMO',
      source: 'resource',
    });
    expect(await access.db.getResourceById({ resourceId: 'r1' })).toEqual(before);
    expect((await access.db.listThreads({ perPage: false })).threads).toHaveLength(2);
  });

  it('does not treat a thread grant as a resource grant', async () => {
    const access = await workingMemoryAccess({
      serverFga: { check: async (_user, { resource }) => resource.type === 'thread' },
    });
    expect(await access.read({ threadId: 't1' })).toMatchObject({ workingMemory: 'RESOURCE MEMO' });
    await expect(access.read()).rejects.toThrow(/403/);
  });

  it('honors a resource policy denial even if the spoofed query identity would be allowed', async () => {
    const access = await workingMemoryAccess({
      serverFga: { check: async (_user, { resource }) => resource.id === 'r2' },
    });
    await expect(access.read({ resourceId: 'r2' })).rejects.toThrow(/403/);
    await expect(access.handlerRead({ resourceId: 'r2' })).rejects.toMatchObject({ status: 403 });
  });

  it('fails closed without an authenticated user when FGA is configured', async () => {
    const access = await workingMemoryAccess({ serverFga: { check: async () => true } });
    const context = new RequestContext();
    context.set(MASTRA_RESOURCE_ID_KEY, 'r1');
    await expect(access.handlerRead({ requestContext: context })).rejects.toThrow(/authenticated user is required/);
  });

  it.each([
    { mode: 'studio' as const, server: false, studio: true, allowed: true },
    { mode: 'studio' as const, server: true, studio: false, allowed: false },
    { mode: 'server' as const, server: true, studio: false, allowed: true },
    { mode: 'server' as const, server: false, studio: true, allowed: false },
    { mode: 'studio' as const, server: true, studio: undefined, allowed: true },
    { mode: 'server' as const, server: undefined, studio: true, allowed: false },
  ])(
    'selects the applicable FGA provider: $mode auth, server=$server, studio=$studio',
    async ({ mode, server, studio, allowed }) => {
      const access = await workingMemoryAccess({
        serverFga: server === undefined ? undefined : { check: async () => server },
        studioFga: studio === undefined ? undefined : { check: async () => studio },
        authMode: mode,
      });
      // Exercise the public handler after auth mode is set, without MCP's server-auth handshake changing it.
      if (allowed) expect(await access.handlerRead()).toMatchObject({ workingMemory: 'RESOURCE MEMO' });
      else await expect(access.handlerRead()).rejects.toMatchObject({ status: 403 });
    },
  );

  it.each([undefined, 't2'])('uses the context thread before dispatch when the argument is %s', async threadId => {
    const access = await workingMemoryAccess({ scope: 'thread', pinnedThread: 't1' });
    expect(await access.read({ threadId })).toMatchObject({ workingMemory: 'THREAD MEMO', source: 'thread' });
  });

  it('retains explicit thread reads and true resource-only reads without a context thread', async () => {
    const resource = await workingMemoryAccess();
    expect(await resource.read()).toMatchObject({ workingMemory: 'RESOURCE MEMO', source: 'resource' });
    const thread = await workingMemoryAccess({ scope: 'thread' });
    expect(await thread.read({ threadId: 't1' })).toMatchObject({ workingMemory: 'THREAD MEMO', source: 'thread' });
    await expect(thread.read()).rejects.toThrow(/threadId is required/);
  });
});

describe('built-in MCP memory and observability toolsets', () => {
  it('offers exactly the planned memory tools', async () => {
    const tools = await setup({ mcp: { toolsets: ['memory'] } })();
    expect(names(tools)).toEqual([
      'clone_thread',
      'create_thread',
      'get_memory_status',
      'get_observations',
      'get_thread',
      'get_working_memory',
      'list_messages',
      'list_threads',
      'update_thread',
    ]);
    expect(Object.keys(jsonSchemaOf(tools.get_observations!).properties)).toContain('waitForPending');
  });

  it('inspects resource working memory in read-only mode without changing stored state', async () => {
    const store = new InMemoryStore();
    const storage = (await store.getStore('memory'))!;
    const now = new Date('2026-01-01T00:00:00Z');
    const own = { id: 'r1', workingMemory: 'Favorite color: blue', createdAt: now, updatedAt: now };
    await storage.saveResource({ resource: own });
    await storage.saveResource({ resource: { ...own, id: 'r2', workingMemory: 'Private document' } });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'r1');
    const tools = await setup({ store, requestContext, workingMemory: true, mcp: { toolsets: ['memory'] } })(
      '?readonly=1',
    );
    const result = await tools.get_working_memory!.execute!({ agentId: 'helper', resourceId: 'r2' }, {} as any);
    expect(result).toMatchObject({ workingMemory: 'Favorite color: blue', source: 'resource' });
    expect(tools.get_working_memory!.mcp?.annotations?.readOnlyHint).toBe(true);
    expect(await storage.getResourceById({ resourceId: 'r1' })).toEqual(own);
    expect(await storage.listThreads({ filter: { resourceId: 'r1' }, perPage: false })).toMatchObject({ threads: [] });
  });

  it("rejects another owner's thread through working-memory inspection", async () => {
    const store = new InMemoryStore();
    const storage = (await store.getStore('memory'))!;
    const now = new Date();
    await storage.saveThread({
      thread: { id: 'secret-thread', resourceId: 'r2', title: '', metadata: {}, createdAt: now, updatedAt: now },
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'r1');
    const tools = await setup({ store, requestContext, workingMemory: true, mcp: { toolsets: ['memory'] } })();
    await expect(
      tools.get_working_memory!.execute!({ agentId: 'helper', threadId: 'secret-thread' }, {} as any),
    ).rejects.toThrow(/403/);
  });

  it('reads working memory through an owned thread and returns null for a missing resource without creating it', async () => {
    const store = new InMemoryStore();
    const storage = (await store.getStore('memory'))!;
    const now = new Date();
    const thread = { id: 'own-thread', resourceId: 'r1', title: '', metadata: {}, createdAt: now, updatedAt: now };
    await storage.saveThread({ thread });
    await storage.saveResource({ resource: { id: 'r1', workingMemory: 'Likes tea', createdAt: now, updatedAt: now } });
    const tools = await setup({ store, workingMemory: true, mcp: { toolsets: ['memory'] } })('?readonly=1');
    expect(
      await tools.get_working_memory!.execute!({ agentId: 'helper', threadId: thread.id, resourceId: 'r1' }, {} as any),
    ).toMatchObject({ workingMemory: 'Likes tea', source: 'resource', threadExists: true });
    expect(
      await tools.get_working_memory!.execute!({ agentId: 'helper', resourceId: 'missing' }, {} as any),
    ).toMatchObject({ workingMemory: null, source: 'resource' });
    expect(await storage.getResourceById({ resourceId: 'missing' })).toBeNull();
    expect(await storage.getThreadById({ threadId: thread.id })).toEqual(thread);
  });

  it('requires memory:read when listing and calling working-memory inspection', async () => {
    const requestContext = new RequestContext();
    const user = { id: 'u1' };
    requestContext.set(MASTRA_USER_KEY, user);
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['mcp:execute']);
    const build = setup({
      requestContext,
      workingMemory: true,
      mcp: { toolsets: ['memory'] },
      server: {
        auth: new SimpleAuth({ tokens: { 'test-token': user } }),
        rbac: {
          getRoles: async () => [],
          getPermissions: async () => requestContext.get(MASTRA_USER_PERMISSIONS_KEY) as string[],
        },
      },
    });
    expect((await build()).get_working_memory).toBeUndefined();
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['mcp:execute', 'memory:read']);
    const tools = await build();
    expect(
      await tools.get_working_memory!.execute!({ agentId: 'helper', resourceId: 'missing' }, {} as any),
    ).toMatchObject({ workingMemory: null });
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['mcp:execute']);
    await expect(
      tools.get_working_memory!.execute!({ agentId: 'helper', resourceId: 'missing' }, {} as any),
    ).rejects.toThrow(/403/);
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
        ['get_working_memory', { agentId: 'secret', resourceId: 'r1' }],
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
