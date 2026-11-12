import { Agent } from '@mastra/core/agent';
import type { RoleDefinition } from '@mastra/core/auth/ee';
import { StaticRBACProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import type { MastraMemory } from '@mastra/core/memory';
import { SimpleAuth } from '@mastra/core/server';
import type { MastraStorage } from '@mastra/core/storage';
import { InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';
import { MCPClient } from '@mastra/mcp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

export interface BuiltinMCPToolsetsTestSuiteConfig {
  suiteName?: string;
  /** Serve the Mastra instance over real HTTP (MCPClient needs a socket) and return its base URL. */
  startServer: (mastra: Mastra) => Promise<{ url: string; close: () => Promise<void> }>;
  /** Storage with a memory domain that supports Observational Memory (e.g. LibSQL). */
  createStorage: () => Promise<{ storage: MastraStorage; cleanup?: () => Promise<void> }>;
  /**
   * A real Memory with Observational Memory enabled at the given scope. `observationalMemory` is spread over the
   * adapter's own Observational Memory options (e.g. a fake observer `model` and low token thresholds).
   */
  createMemory: (
    storage: MastraStorage,
    scope: 'thread' | 'resource',
    observationalMemory?: Record<string, unknown>,
  ) => MastraMemory;
}

type TestUser = { id: string; role: string };

const USERS: Record<string, TestUser> = {
  alice: { id: 'alice', role: 'user' },
  bob: { id: 'bob', role: 'user' },
  'no-obs': { id: 'no-obs', role: 'no-obs' },
  reader: { id: 'reader', role: 'memory-reader' },
};

const ROLES: RoleDefinition[] = [
  { id: 'user', name: 'User', permissions: ['*:read', '*:write', '*:execute'] },
  { id: 'no-obs', name: 'No observability', permissions: ['agents:*', 'memory:*', 'mcp:*'] },
  { id: 'memory-reader', name: 'Memory reader', permissions: ['agents:read', 'memory:read', 'mcp:*'] },
];

const OBSERVER_DELAY_MS = 1500;
const OBSERVED = 'User keeps bees on a Lisbon rooftop';
const HUGE_OBSERVATIONS_START = 'Huge observations: ';
/** Most MCP clients drop larger tool results (the server's MAX_RESULT_CHARS). */
const MAX_RESULT_CHARS = 40_000;

/** A provider-free LanguageModelV2 that answers `text`, optionally after a delay. */
function fakeModel(text: string, delayMs = 0) {
  const usage = { inputTokens: 50, outputTokens: 20, totalTokens: 70 };
  const wait = () => new Promise(resolve => setTimeout(resolve, delayMs));
  return {
    specificationVersion: 'v2' as const,
    provider: 'fake',
    modelId: 'fake-model',
    supportedUrls: {},
    doGenerate: async () => {
      await wait();
      return { content: [{ type: 'text', text }], finishReason: 'stop', usage, warnings: [] };
    },
    doStream: async () => {
      await wait();
      const parts = [
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 't' },
        { type: 'text-delta', id: 't', delta: text },
        { type: 'text-end', id: 't' },
        { type: 'finish', finishReason: 'stop', usage },
      ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      };
    },
  };
}

type ToolResult = { error?: boolean; isError?: boolean; content?: Array<{ text?: string }>; [key: string]: unknown };

const OPS = ['aggregate', 'breakdown', 'timeseries', 'percentiles'] as const;

/**
 * Memory and observability MCP tools must allow and deny exactly what their HTTP routes allow and deny for the
 * same user, and the multi-route analytics tools must dispatch each `op` to that op's own route.
 */
export function createBuiltinMCPToolsetsTestSuite(config: BuiltinMCPToolsetsTestSuiteConfig) {
  const { suiteName = 'Built-in MCP memory and observability toolsets', startServer } = config;

  describe(suiteName, () => {
    let server: Awaited<ReturnType<BuiltinMCPToolsetsTestSuiteConfig['startServer']>>;
    let cleanup: (() => Promise<void>) | undefined;
    const clients: MCPClient[] = [];

    beforeAll(async () => {
      const created = await config.createStorage();
      cleanup = created.cleanup;
      const { storage } = created;
      const agent = (id: string, scope: 'thread' | 'resource') =>
        new Agent({
          id,
          name: id,
          instructions: 'Test',
          model: 'openai/gpt-4o',
          memory: config.createMemory(storage, scope),
        });
      const mastra = new Mastra({
        logger: false,
        storage: new MastraCompositeStore({
          id: 'toolsets-suite',
          default: storage,
          domains: { observability: await new InMemoryStore().getStore('observability') },
        }),
        agents: {
          'thread-agent': agent('thread-agent', 'thread'),
          'resource-agent': agent('resource-agent', 'resource'),
          // Answers at once; its observer takes OBSERVER_DELAY_MS, so buffering is still running when call_agent returns.
          'buffer-agent': new Agent({
            id: 'buffer-agent',
            name: 'buffer-agent',
            instructions: 'Test',
            model: fakeModel('Noted.') as any,
            memory: config.createMemory(storage, 'thread', {
              model: fakeModel(`<observations>\n* ${OBSERVED}\n</observations>`, OBSERVER_DELAY_MS),
              observation: { messageTokens: 2000, bufferTokens: 0.05 },
            }),
          }),
        },
        server: {
          auth: new SimpleAuth<TestUser>({ tokens: USERS, mapUserToResourceId: user => user.id }),
          rbac: new StaticRBACProvider<TestUser>({ roles: ROLES, getUserRoles: user => [user.role] }),
        },
      });

      await storage.init();
      const memoryStore = (await storage.getStore('memory'))!;
      for (const user of ['alice', 'bob']) {
        const now = new Date();
        await memoryStore.saveThread({
          thread: { id: `${user}-thread`, resourceId: user, title: '', metadata: {}, createdAt: now, updatedAt: now },
        });
        await memoryStore.saveMessages({
          messages: [
            {
              id: `${user}-message`,
              threadId: `${user}-thread`,
              resourceId: user,
              role: 'user',
              createdAt: now,
              content: { format: 2, parts: [{ type: 'text', text: `${user} secret message` }] },
            },
          ],
        });
        for (const [scope, threadId] of [
          ['thread', `${user}-thread`],
          ['resource', null],
        ] as const) {
          const record = await memoryStore.initializeObservationalMemory({
            threadId,
            resourceId: user,
            scope,
            config: {},
          });
          await memoryStore.updateActiveObservations({
            id: record.id,
            observations: `${user} ${scope} secret`,
            tokenCount: 10,
            lastObservedAt: now,
          });
        }
      }
      // Active observations far past what an MCP client accepts in one tool result.
      const now = new Date();
      await memoryStore.saveThread({
        thread: {
          id: 'alice-huge-thread',
          resourceId: 'alice',
          title: '',
          metadata: {},
          createdAt: now,
          updatedAt: now,
        },
      });
      const huge = await memoryStore.initializeObservationalMemory({
        threadId: 'alice-huge-thread',
        resourceId: 'alice',
        scope: 'thread',
        config: {},
      });
      await memoryStore.updateActiveObservations({
        id: huge.id,
        observations: `${HUGE_OBSERVATIONS_START}${'o'.repeat(60_000)}`,
        tokenCount: 15_000,
        lastObservedAt: now,
      });

      server = await startServer(mastra);
      for (const [index, value] of [0.2, 0.9].entries()) {
        const traceId = `signal-trace-${index}`;
        expect(
          (
            await http('alice', 'POST', '/observability/feedback', {
              feedback: { traceId, feedbackType: 'rating', value },
            })
          ).status,
        ).toBeLessThan(300);
        expect(
          (
            await http('alice', 'POST', '/observability/scores', {
              score: { traceId, scorerId: 'quality', score: value, entityName: `agent-${index}` },
            })
          ).status,
        ).toBeLessThan(300);
      }
    });

    afterAll(async () => {
      await Promise.all(clients.map(client => client.disconnect()));
      await server?.close();
      await cleanup?.();
    });

    async function http(token: string, method: string, path: string, body?: unknown) {
      const response = await fetch(`${server.url}/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : undefined };
    }

    const connect = (token: string, headers: Record<string, string> = {}) => {
      const client = new MCPClient({
        id: `toolsets-${token}-${clients.length}`,
        servers: {
          mastra: {
            url: new URL(`${server.url}/api/mcp`),
            requestInit: { headers: { authorization: `Bearer ${token}`, ...headers } },
            onToolError: 'return',
          },
        },
      });
      clients.push(client);
      return client;
    };

    const listTools = async (token: string, headers?: Record<string, string>) => {
      const tools = await connect(token, headers).listTools();
      return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name.replace(/^mastra_/, ''), tool]));
    };

    const callTool = async (token: string, name: string, args: Record<string, unknown>): Promise<ToolResult> => {
      const client = connect(token);
      try {
        const tool = (await client.listTools())[`mastra_${name}`];
        if (!tool) return { isError: true, content: [{ text: `tool ${name} not offered` }] };
        return (await tool.execute!(args, {} as any)) as ToolResult;
      } finally {
        await client.disconnect();
      }
    };

    /** The input schema a caller sees in a raw `tools/list`. */
    const inputSchemaOf = async (token: string, name: string, headers: Record<string, string> = {}) => {
      const response = await fetch(`${server.url}/api/mcp`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...headers,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      const raw = await response.text();
      const json = JSON.parse(raw.startsWith('{') ? raw : /^data: (.*)$/m.exec(raw)![1]!);
      return json.result.tools.find((tool: { name: string }) => tool.name === name)?.inputSchema;
    };

    const text = (result: ToolResult) => (result.content ?? []).map(part => part.text ?? '').join('');

    const payload = (result: ToolResult): any => {
      if (result.structuredContent !== undefined) return result.structuredContent;
      if (!Array.isArray(result.content)) return result;
      return JSON.parse(text(result));
    };

    /** `200` for success, else the HTTP status carried in the MCP error, or `not offered`. */
    const outcome = (result: ToolResult): number | 'not offered' | 'invalid' => {
      if (result.error === true) return 'invalid';
      if (!result.isError) return 200;
      if (text(result).includes('not offered')) return 'not offered';
      return Number(/"?(\d{3}) /.exec(text(result))?.[1] ?? 500);
    };

    describe('memory ownership parity', () => {
      const thread = 'alice-thread';
      const cases: Array<[string, Record<string, unknown>, string, string, unknown?]> = [
        ['get_thread', { threadId: thread }, 'GET', `/memory/threads/${thread}`],
        ['list_messages', { threadId: thread }, 'GET', `/memory/threads/${thread}/messages`],
        [
          'get_observations',
          { agentId: 'thread-agent', threadId: thread, resourceId: 'alice' },
          'GET',
          `/memory/observational-memory?agentId=thread-agent&resourceId=alice&threadId=${thread}`,
        ],
        [
          'get_observations',
          { agentId: 'thread-agent', threadId: thread, resourceId: 'alice', waitForPending: false },
          'GET',
          `/memory/observational-memory?agentId=thread-agent&resourceId=alice&threadId=${thread}`,
        ],
        [
          'get_observations',
          { agentId: 'thread-agent', threadId: thread, resourceId: 'alice', waitForPending: true },
          'POST',
          '/memory/observational-memory/buffer-status',
          { agentId: 'thread-agent', threadId: thread, resourceId: 'alice' },
        ],
        [
          'get_memory_status',
          { agentId: 'thread-agent', threadId: thread, resourceId: 'alice' },
          'GET',
          `/memory/status?agentId=thread-agent&resourceId=alice&threadId=${thread}`,
        ],
        [
          'update_thread',
          { agentId: 'thread-agent', threadId: thread, title: 'renamed' },
          'PATCH',
          `/memory/threads/${thread}?agentId=thread-agent`,
          { title: 'renamed' },
        ],
        [
          'clone_thread',
          { agentId: 'thread-agent', threadId: thread },
          'POST',
          `/memory/threads/${thread}/clone?agentId=thread-agent`,
          {},
        ],
      ];

      it.each(cases)("%s %j: the owner's call succeeds, another user's fails with the HTTP status", async (...row) => {
        const [tool, args, method, path, body] = row;
        for (const token of ['alice', 'bob']) {
          const mcp = outcome(await callTool(token, tool, args));
          const viaHttp = (await http(token, method, path, body)).status;
          expect({ token, mcp }).toEqual({ token, mcp: viaHttp });
          expect(viaHttp === 200).toBe(token === 'alice');
        }
      });

      it('resource-scoped observations always resolve to the caller, whatever resourceId is passed', async () => {
        const result = await callTool('bob', 'get_observations', { agentId: 'resource-agent', resourceId: 'alice' });
        const viaHttp = await http(
          'bob',
          'GET',
          '/memory/observational-memory?agentId=resource-agent&resourceId=alice',
        );
        expect(viaHttp.status).toBe(200);
        expect(payload(result).record.activeObservations).toBe('bob resource secret');
        expect(viaHttp.body.record.activeObservations).toBe('bob resource secret');
      });

      it("lists only the caller's threads, like GET /memory/threads", async () => {
        const result = await callTool('bob', 'list_threads', { agentId: 'thread-agent', resourceId: 'alice' });
        const viaHttp = await http('bob', 'GET', '/memory/threads?agentId=thread-agent&resourceId=alice');
        const ids = (threads: Array<{ id: string }>) => threads.map(t => t.id);
        expect(ids(payload(result).threads)).toEqual(['bob-thread']);
        expect(ids(viaHttp.body.threads)).toEqual(['bob-thread']);
      });

      it("save_messages cannot write into another user's thread", async () => {
        const message = {
          id: 'intruder',
          threadId: thread,
          resourceId: 'bob',
          role: 'user',
          type: 'text',
          createdAt: new Date().toISOString(),
          content: { format: 2, parts: [{ type: 'text', text: 'hi' }] },
        };
        const mcp = outcome(await callTool('bob', 'save_messages', { agentId: 'thread-agent', messages: [message] }));
        const viaHttp = await http('bob', 'POST', '/memory/save-messages?agentId=thread-agent', {
          messages: [message],
        });
        expect(viaHttp.status, JSON.stringify(viaHttp.body)).toBe(403);
        expect(mcp).toBe(viaHttp.status);
      });
    });

    describe('Observational Memory tools', () => {
      it('offers get_observations, not the Studio-only history and wait tools', async () => {
        const names = Object.keys(await listTools('alice'));
        expect(names).toContain('get_observations');
        expect(names).toContain('get_memory_status');
        expect(names).not.toContain('get_observation_history');
        expect(names).not.toContain('wait_for_observations');
        const schema = await inputSchemaOf('alice', 'get_observations');
        expect(schema.properties.waitForPending.type).toBe('boolean');
      });

      it('get_observations returns the current record without waiting, like GET /memory/observational-memory', async () => {
        const path = '/memory/observational-memory?agentId=thread-agent&resourceId=alice&threadId=alice-thread';
        const viaHttp = await http('alice', 'GET', path);
        for (const args of [{}, { waitForPending: false }]) {
          const result = payload(
            await callTool('alice', 'get_observations', { agentId: 'thread-agent', threadId: 'alice-thread', ...args }),
          );
          expect(result).toEqual({ record: viaHttp.body.record });
          expect(result.record.activeObservations).toBe('alice thread secret');
        }
      });

      it('waitForPending: true waits for buffering started by call_agent, like POST buffer-status', async () => {
        const threadId = 'alice-buffered';
        const scope = { agentId: 'buffer-agent', threadId };
        const message = `Some facts about me. ${OBSERVED}. `.repeat(20);
        const called = await callTool('alice', 'call_agent', { ...scope, message });
        expect(outcome(called), text(called)).toBe(200);

        const pending = payload(await callTool('alice', 'get_observations', scope)).record;
        expect(pending?.isBufferingObservation).toBe(true);
        expect(JSON.stringify(pending ?? {})).not.toContain(OBSERVED);

        const done = payload(await callTool('alice', 'get_observations', { ...scope, waitForPending: true })).record;
        expect(done.isBufferingObservation).toBe(false);
        expect(JSON.stringify(done.bufferedObservationChunks)).toContain(OBSERVED);

        const viaHttp = await http('alice', 'POST', '/memory/observational-memory/buffer-status', scope);
        expect(viaHttp.status).toBe(200);
        expect(done).toEqual(viaHttp.body.record);

        const asBob = { ...scope, resourceId: 'alice' };
        const bobHttp = {
          false: await http('bob', 'GET', `/memory/observational-memory?${new URLSearchParams(asBob)}`),
          true: await http('bob', 'POST', '/memory/observational-memory/buffer-status', asBob),
        };
        for (const waitForPending of [false, true] as const) {
          const bob = await callTool('bob', 'get_observations', { ...asBob, waitForPending });
          expect(bobHttp[`${waitForPending}`].status).toBe(403);
          expect(outcome(bob)).toBe(bobHttp[`${waitForPending}`].status);
          expect(text(bob)).not.toContain(OBSERVED);
        }
      });

      it('get_observations clips an oversized record to fit one tool result; HTTP keeps it whole', async () => {
        const scope = { agentId: 'thread-agent', threadId: 'alice-huge-thread' };
        const viaHttp = await http('alice', 'GET', `/memory/observational-memory?${new URLSearchParams(scope)}`);
        expect(viaHttp.status).toBe(200);
        expect(viaHttp.body.record.activeObservations).toHaveLength(HUGE_OBSERVATIONS_START.length + 60_000);

        for (const waitForPending of [false, true]) {
          const result = await callTool('alice', 'get_observations', { ...scope, waitForPending });
          expect(outcome(result), text(result)).toBe(200);
          expect(text(result).length).toBeLessThanOrEqual(MAX_RESULT_CHARS);
          const { record } = payload(result);
          expect(record.id).toBe(viaHttp.body.record.id);
          expect(record.activeObservations.startsWith(HUGE_OBSERVATIONS_START)).toBe(true);
          expect(record.activeObservations).toMatch(/\[truncated \d+ chars\]$/);
        }
      });

      it('a memory:read caller gets get_observations without waitForPending, and cannot wait (buffer-status is 403)', async () => {
        const path = '/memory/observational-memory?agentId=resource-agent';
        expect(Object.keys(await listTools('reader'))).toContain('get_observations');
        expect((await inputSchemaOf('reader', 'get_observations')).properties).not.toHaveProperty('waitForPending');

        const viaHttp = await http('reader', 'GET', path);
        expect(viaHttp.status).toBe(200);
        const result = await callTool('reader', 'get_observations', { agentId: 'resource-agent' });
        expect(payload(result)).toEqual({ record: viaHttp.body.record });

        const waited = await callTool('reader', 'get_observations', {
          agentId: 'resource-agent',
          waitForPending: true,
        });
        // Not in this caller's schema, so the call is rejected as invalid input and never reaches buffer-status.
        expect(outcome(waited)).toBe('invalid');
        expect(
          (await http('reader', 'POST', '/memory/observational-memory/buffer-status', { agentId: 'resource-agent' }))
            .status,
        ).toBe(403);
      });
    });

    describe('read-only mode', () => {
      it('keeps get_observations without waitForPending', async () => {
        const readonly = { 'x-mcp-readonly': '1' };
        expect((await inputSchemaOf('alice', 'get_observations', readonly)).properties).not.toHaveProperty(
          'waitForPending',
        );
        const client = connect('alice', readonly);
        const tool = (await client.listTools()).mastra_get_observations!;
        const scope = { agentId: 'thread-agent', threadId: 'alice-thread' };
        const result = (await tool.execute!(scope, {} as any)) as ToolResult;
        expect(payload(result).record.activeObservations).toBe('alice thread secret');
        const waited = (await tool.execute!({ ...scope, waitForPending: true }, {} as any)) as ToolResult;
        // Not in this caller's schema, so the call is rejected as invalid input and never reaches buffer-status.
        expect(outcome(waited)).toBe('invalid');
      });

      it('keeps POST-backed observability reads and drops memory writes', async () => {
        const tools = await listTools('alice', { 'x-mcp-readonly': '1' });
        const names = Object.keys(tools);
        for (const name of ['analyze_metrics', 'analyze_feedback', 'list_threads', 'get_observations']) {
          expect(names).toContain(name);
          expect((tools[name] as any).mcp?.annotations?.readOnlyHint ?? true).toBe(true);
        }
        for (const name of ['create_thread', 'update_thread', 'clone_thread', 'save_messages']) {
          expect(names).not.toContain(name);
        }
      });
    });

    describe('observability analytics dispatch', () => {
      const bodies: Record<string, Record<(typeof OPS)[number], Record<string, unknown>>> = {
        feedback: {
          aggregate: { feedbackType: 'rating', aggregation: 'avg' },
          breakdown: { feedbackType: 'rating', aggregation: 'avg', groupBy: ['feedbackSource'] },
          timeseries: { feedbackType: 'rating', aggregation: 'avg', interval: '1h' },
          percentiles: { feedbackType: 'rating', percentiles: [0.5], interval: '1h' },
        },
        scores: {
          aggregate: { scorerId: 'quality', aggregation: 'avg' },
          breakdown: { scorerId: 'quality', aggregation: 'avg', groupBy: ['entityName'] },
          timeseries: { scorerId: 'quality', aggregation: 'avg', interval: '1h' },
          percentiles: { scorerId: 'quality', percentiles: [0.5], interval: '1h' },
        },
        metrics: {
          aggregate: { name: ['mastra_agent_duration_ms'], aggregation: 'sum' },
          breakdown: { name: ['mastra_agent_duration_ms'], aggregation: 'sum', groupBy: ['entityName'] },
          timeseries: { name: ['mastra_agent_duration_ms'], aggregation: 'sum', interval: '1h' },
          percentiles: { name: 'mastra_agent_duration_ms', percentiles: [0.5], interval: '1h' },
        },
      };

      for (const source of Object.keys(bodies)) {
        it.each(OPS)(`analyze_${source} op %s returns what its own route returns`, async op => {
          const body = bodies[source]![op];
          const viaHttp = await http('alice', 'POST', `/observability/${source}/${op}`, body);
          expect(viaHttp.status).toBe(200);
          const result = await callTool('alice', `analyze_${source}`, { op, ...body });
          expect(outcome(result)).toBe(200);
          expect(payload(result)).toEqual(viaHttp.body);
          // The other ops' routes answer differently, so equality pins the dispatch target.
          if (op === 'aggregate') {
            const breakdown = await http(
              'alice',
              'POST',
              `/observability/${source}/breakdown`,
              bodies[source]!.breakdown,
            );
            expect(breakdown.body).not.toEqual(viaHttp.body);
          }
        });
      }

      it('list_metric_names answers each level from its discovery route', async () => {
        const levels: Array<[Record<string, unknown>, string]> = [
          [{}, '/observability/discovery/metric-names'],
          [
            { metricName: 'mastra_agent_duration_ms' },
            '/observability/discovery/metric-label-keys?metricName=mastra_agent_duration_ms',
          ],
          [
            { metricName: 'mastra_agent_duration_ms', labelKey: 'status' },
            '/observability/discovery/metric-label-values?metricName=mastra_agent_duration_ms&labelKey=status',
          ],
        ];
        for (const [args, path] of levels) {
          const viaHttp = await http('alice', 'GET', path);
          expect(viaHttp.status).toBe(200);
          expect(payload(await callTool('alice', 'list_metric_names', args))).toEqual(viaHttp.body);
        }
        // Bad arguments are a 400, like a route rejecting its input.
        expect(outcome(await callTool('alice', 'list_metric_names', { labelKey: 'status' }))).toBe(400);
      });

      it('offers no observability tools without observability:read, and every op route answers 403', async () => {
        const names = Object.keys(await listTools('no-obs'));
        expect(names).toContain('list_threads');
        expect(names.filter(name => /trace|span|log|metric|score|feedback/.test(name))).toEqual([]);
        for (const source of Object.keys(bodies)) {
          for (const op of OPS) {
            expect((await http('no-obs', 'POST', `/observability/${source}/${op}`, bodies[source]![op])).status).toBe(
              403,
            );
          }
        }
      });
    });
  });
}
