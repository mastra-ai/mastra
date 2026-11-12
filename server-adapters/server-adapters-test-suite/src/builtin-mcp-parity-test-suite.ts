import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { Agent } from '@mastra/core/agent';
import type { IFGAProvider, RoleDefinition } from '@mastra/core/auth/ee';
import { DEFAULT_ROLES, FGADeniedError, StaticRBACProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SimpleAuth } from '@mastra/core/server';
import type { ServerMCPConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel, MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { MCPClient } from '@mastra/mcp';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

export interface BuiltinMCPParityTestSuiteConfig {
  suiteName?: string;
  /** Serve the Mastra instance over real HTTP (MCPClient needs a socket) and return its base URL. */
  startServer: (mastra: Mastra) => Promise<{ url: string; close: () => Promise<void> }>;
}

type TestUser = { id: string; role: string; studioRole: string };

const USERS: Record<string, TestUser> = {
  'owner-token': { id: 'user-owner', role: 'owner', studioRole: 'owner' },
  'member-token': { id: 'user-member', role: 'member', studioRole: 'member' },
  'member2-token': { id: 'user-member2', role: 'member', studioRole: 'member' },
  // Read-only; as a Studio user it could execute, which the MCP endpoint must ignore.
  'viewer-token': { id: 'user-viewer', role: 'viewer', studioRole: 'owner' },
  'no-agents-token': { id: 'user-no-agents', role: 'no-agents', studioRole: 'no-agents' },
  'no-workflows-token': { id: 'user-no-workflows', role: 'no-workflows', studioRole: 'no-workflows' },
  'no-tools-token': { id: 'user-no-tools', role: 'no-tools', studioRole: 'no-tools' },
  'no-mcp-execute-token': { id: 'user-no-mcp-execute', role: 'no-mcp-execute', studioRole: 'no-mcp-execute' },
  'no-mcp-token': { id: 'user-no-mcp', role: 'no-mcp', studioRole: 'no-mcp' },
};

const ROLES: RoleDefinition[] = [
  ...DEFAULT_ROLES,
  {
    id: 'no-agents',
    name: 'No agent execution',
    permissions: ['*:read', 'workflows:execute', 'tools:execute', 'mcp:execute'],
  },
  {
    id: 'no-workflows',
    name: 'No workflow execution',
    permissions: ['*:read', 'agents:execute', 'tools:execute', 'mcp:execute', 'memory:*'],
  },
  {
    id: 'no-tools',
    name: 'No tool execution',
    permissions: ['*:read', 'agents:execute', 'workflows:execute', 'mcp:execute', 'memory:*'],
  },
  {
    id: 'no-mcp-execute',
    name: 'MCP discovery only',
    permissions: ['*:read', 'agents:execute', 'workflows:execute', 'tools:execute', 'memory:*'],
  },
  { id: 'no-mcp', name: 'No MCP', permissions: ['agents:*', 'workflows:*', 'tools:*', 'memory:*'] },
];

const FGA_GRANTS: Record<string, string[]> = {
  'agent:test-agent': ['*'],
  'agent:locked-agent': ['user-owner'],
  'workflow:test-workflow': ['*'],
  'workflow:locked-workflow': ['user-owner'],
  'tool:test-tool': ['*'],
  'tool:whoami': ['*'],
  'tool:locked-tool': ['user-owner'],
};

/** In-memory relationship store standing in for an external FGA service. Thread ownership is left to handlers. */
class TupleFGAProvider implements IFGAProvider<TestUser> {
  async check(user: TestUser, { resource }: { resource: { type: string; id: string } }): Promise<boolean> {
    if (resource.type === 'thread') return true;
    const grantees = FGA_GRANTS[`${resource.type}:${resource.id}`] ?? ['*'];
    return grantees.includes('*') || grantees.includes(user.id);
  }

  async require(user: TestUser, params: { resource: { type: string; id: string }; permission: any }): Promise<void> {
    if (!(await this.check(user, params))) throw new FGADeniedError(user, params.resource, params.permission);
  }

  async filterAccessible<T extends { id: string }>(user: TestUser, resources: T[], resourceType: string) {
    const allowed: T[] = [];
    for (const resource of resources) {
      if (await this.check(user, { resource: { type: resourceType, id: resource.id } })) allowed.push(resource);
    }
    return allowed;
  }
}

function createParityMastra(mcp: ServerMCPConfig = {}) {
  const memory = new MockMemory({ storage: new InMemoryStore() });
  const makeAgent = (id: string, description?: string) =>
    new Agent({
      id,
      name: id,
      description,
      instructions: 'You are a test agent',
      model: createMockModel({ mockText: `hello from ${id}` }),
      memory,
    });

  const approvalStep = createStep({
    id: 'approval',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ approved: z.boolean() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) return suspend({ reason: 'needs approval' });
      return { approved: resumeData.approved };
    },
  });
  const makeWorkflow = (id: string) =>
    createWorkflow({
      id,
      description: `The ${id} workflow`,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
    })
      .then(approvalStep)
      .commit();

  const makeTool = (id: string) =>
    createTool({
      id,
      description: 'Echoes its input',
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => ({ echoed: text }),
    });
  // Reports the user in the RequestContext the tool runs with.
  const whoami = createTool({
    id: 'whoami',
    description: 'Returns the calling user',
    inputSchema: z.object({}),
    execute: async (_input, context) => ({ userId: (context?.requestContext?.get('user') as TestUser)?.id ?? null }),
  });

  const tokens = Object.fromEntries(Object.entries(USERS));
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
    agents: {
      'test-agent': makeAgent('test-agent', 'A helpful test agent'),
      'locked-agent': makeAgent('locked-agent', 'Only the owner may call this agent'),
    },
    workflows: { 'test-workflow': makeWorkflow('test-workflow'), 'locked-workflow': makeWorkflow('locked-workflow') },
    tools: { 'test-tool': makeTool('test-tool'), 'locked-tool': makeTool('locked-tool'), whoami },
    server: {
      auth: new SimpleAuth<TestUser>({ tokens, mapUserToResourceId: user => user.id }),
      rbac: new StaticRBACProvider<TestUser>({ roles: ROLES, getUserRoles: user => [user.role] }),
      fga: new TupleFGAProvider(),
      mcp,
    },
    studio: {
      auth: new SimpleAuth<TestUser>({ tokens, mapUserToResourceId: user => user.id }),
      rbac: new StaticRBACProvider<TestUser>({ roles: ROLES, getUserRoles: user => [user.studioRole] }),
    },
  });
  return { mastra, memory, makeAgent, makeWorkflow, makeTool };
}

type ToolResult = {
  error?: boolean;
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: any;
};

/** Text of an MCP tool result, which for errors carries `<status> <message>`. */
function resultText(result: ToolResult): string {
  return (result.content ?? []).map(part => part.text ?? '').join('');
}

/** A successful MCP result's payload (structuredContent, else parsed text). */
function payload(result: ToolResult): any {
  if (result.structuredContent !== undefined) return result.structuredContent;
  // MCPClient resolves tools that declare an outputSchema to the structured output itself.
  if (!Array.isArray(result.content)) return result;
  const text = resultText(result);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** MCP outcome: `ok`, the HTTP status in the error, `not offered`, or `invalid` (rejected by the advertised schema). */
function mcpOutcome(result: ToolResult): number | 'ok' | 'not offered' | 'invalid' {
  // MCPClient validates arguments against the advertised schema (e.g. an id missing from the enum).
  if (result.error === true) return 'invalid';
  if (!result.isError) return 'ok';
  const text = resultText(result);
  if (text.includes('not offered')) return 'not offered';
  const status = /"?(\d{3}) /.exec(text)?.[1];
  return status ? Number(status) : 500;
}

/**
 * The built-in `/api/mcp` server must allow and deny exactly what the equivalent HTTP routes allow and deny
 * for the same user (RBAC, FGA, thread ownership), plus its own `mcp:read` / `mcp:execute` gates.
 */
export function createBuiltinMCPParityTestSuite(config: BuiltinMCPParityTestSuiteConfig) {
  const { suiteName = 'Built-in MCP server parity', startServer } = config;

  describe(suiteName, () => {
    let server: Awaited<ReturnType<BuiltinMCPParityTestSuiteConfig['startServer']>>;
    let setup: ReturnType<typeof createParityMastra>;
    const clients: MCPClient[] = [];

    beforeAll(async () => {
      setup = createParityMastra();
      server = await startServer(setup.mastra);
    });

    afterAll(async () => {
      await Promise.all(clients.map(client => client.disconnect()));
      await server?.close();
    });

    const http = async (token: string | undefined, method: string, path: string, body?: unknown) => {
      const response = await fetch(`${server.url}/api${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : undefined };
    };

    const connect = (token: string, options: { path?: string; headers?: Record<string, string> } = {}) => {
      const client = new MCPClient({
        id: `mcp-${token}-${clients.length}`,
        servers: {
          mastra: {
            url: new URL(`${server.url}${options.path ?? '/api/mcp'}`),
            requestInit: { headers: { authorization: `Bearer ${token}`, ...options.headers } },
            onToolError: 'return',
          },
        },
      });
      clients.push(client);
      return client;
    };

    /** Raw MCP tool list (names → definitions) as the server advertises it. */
    const listTools = async (token: string, options?: Parameters<typeof connect>[1]) => {
      const tools = await connect(token, options).listTools();
      return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name.replace(/^mastra_/, ''), tool]));
    };

    const callTool = async (token: string, name: string, args: Record<string, unknown>): Promise<ToolResult> => {
      const tools = await connect(token).listTools();
      const tool = tools[`mastra_${name}`];
      if (!tool) return { isError: true, content: [{ type: 'text', text: `tool ${name} not offered` }] };
      return (await tool.execute!(args, {} as any)) as ToolResult;
    };

    describe('transport auth', () => {
      it('rejects requests without a bearer token (401), like HTTP', async () => {
        const response = await fetch(`${server.url}/api/mcp`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        expect(response.status).toBe(401);
        expect((await http(undefined, 'GET', '/agents')).status).toBe(401);
      });

      it('does not accept the apiKey query parameter or cookies as MCP credentials', async () => {
        const init = {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        };
        expect((await fetch(`${server.url}/api/mcp?apiKey=owner-token`, init)).status).toBe(401);
        expect(
          (
            await fetch(`${server.url}/api/mcp`, {
              ...init,
              headers: { ...init.headers, cookie: 'mastra-token=owner-token' },
            })
          ).status,
        ).toBe(401);
        // The same query credential still works for ordinary routes.
        expect((await fetch(`${server.url}/api/agents?apiKey=owner-token`)).status).toBe(200);
      });

      it('requires mcp:read to connect', async () => {
        const response = await fetch(`${server.url}/api/mcp`, {
          method: 'POST',
          headers: {
            authorization: 'Bearer no-mcp-token',
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        expect(response.status).toBe(403);
        expect(await listTools('no-mcp-token')).toEqual({});
        // Their HTTP access is unaffected.
        expect((await http('no-mcp-token', 'GET', '/agents')).status).toBe(200);
      });

      it('ignores the Studio client-type header (always server.auth / server.rbac)', async () => {
        const viaStudioHeader = await listTools('viewer-token', { headers: { 'x-mastra-client-type': 'studio' } });
        expect(Object.keys(viaStudioHeader)).toEqual([]);
      });

      it('leaves Studio and cookie auth of ordinary routes unchanged', async () => {
        const execute = (headers: Record<string, string>) =>
          fetch(`${server.url}/api/tools/test-tool/execute`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify({ data: { text: 'x' } }),
          });
        // viewer has server role `viewer` but Studio role `owner`.
        expect((await execute({ authorization: 'Bearer viewer-token' })).status).toBe(403);
        expect((await execute({ authorization: 'Bearer viewer-token', 'x-mastra-client-type': 'studio' })).status).toBe(
          200,
        );
        expect(
          (await fetch(`${server.url}/api/agents`, { headers: { cookie: 'mastra-token=owner-token' } })).status,
        ).toBe(200);
      });
    });

    describe('catalogue', () => {
      it('offers the operation tools and registered tools as entity tools by default', async () => {
        const names = Object.keys(await listTools('owner-token')).sort();
        expect(names).toEqual(
          [
            'call_agent',
            'cancel_workflow_run',
            'get_agent',
            'get_workflow',
            'get_workflow_run',
            'list_agents',
            'list_workflows',
            'resume_workflow_run',
            'start_workflow',
            'tool_locked-tool',
            'tool_test-tool',
            'tool_whoami',
            // memory + observability(_analytics): MockMemory agent and the default in-memory observability store.
            'analyze_feedback',
            'analyze_metrics',
            'analyze_scores',
            'clone_thread',
            'create_thread',
            'get_memory_status',
            'get_observations',
            'get_span',
            'get_thread',
            'get_trace',
            'get_trace_trajectory',
            'list_feedback',
            'list_logs',
            'list_messages',
            'list_metric_names',
            'list_scores',
            'list_threads',
            'list_traces',
            'save_messages',
            'search_memory',
            'update_thread',
          ].sort(),
        );
      });

      it('lists only the agents the caller can see, like GET /agents', async () => {
        for (const token of ['owner-token', 'member-token']) {
          const result = await callTool(token, 'list_agents', {});
          const httpResult = await http(token, 'GET', '/agents');
          expect(
            payload(result)
              .agents.map((a: any) => a.id)
              .sort(),
          ).toEqual(Object.keys(httpResult.body).sort());
        }
      });

      it('hides tools whose backing route the caller would get 403 for', async () => {
        expect(Object.keys(await listTools('no-agents-token'))).not.toContain('call_agent');
        expect(Object.keys(await listTools('no-workflows-token'))).not.toContain('start_workflow');
        const noTools = Object.keys(await listTools('no-tools-token'));
        expect(noTools.filter(name => name.startsWith('tool_'))).toEqual([]);
        // FGA: member can't execute locked-tool.
        expect(Object.keys(await listTools('member-token'))).not.toContain('tool_locked-tool');
      });

      it('offers no tools without mcp:execute, though HTTP still allows the same calls', async () => {
        expect(Object.keys(await listTools('no-mcp-execute-token'))).toEqual([]);
        expect(Object.keys(await listTools('viewer-token'))).toEqual([]);
        expect(
          (await http('no-mcp-execute-token', 'POST', '/tools/test-tool/execute', { data: { text: 'x' } })).status,
        ).toBe(200);
      });

      it('tracks agents added after startup', async () => {
        setup.mastra.addAgent(setup.makeAgent('late-agent', 'Added later'), 'late-agent');
        const result = await callTool('owner-token', 'list_agents', {});
        expect(payload(result).agents.map((a: any) => a.id)).toContain('late-agent');
      });

      it('narrows toolsets and read-only per request but never widens them', async () => {
        const agentsOnly = Object.keys(await listTools('owner-token', { path: '/api/mcp?toolsets=agents,bogus' }));
        expect(agentsOnly.sort()).toEqual(['call_agent', 'get_agent', 'list_agents']);
        const readOnly = Object.keys(
          await listTools('owner-token', {
            headers: { 'x-mcp-readonly': '1', 'x-mcp-toolsets': 'agents,workflows,tools' },
          }),
        );
        // Read-only drops every execute-backed tool; registered tools fall back to list_tools/get_tool.
        expect(readOnly.sort()).toEqual([
          'get_agent',
          'get_tool',
          'get_workflow',
          'get_workflow_run',
          'list_agents',
          'list_tools',
          'list_workflows',
        ]);
        const both = Object.keys(
          await listTools('owner-token', { path: '/api/mcp?readonly=1', headers: { 'x-mcp-toolsets': 'workflows' } }),
        );
        expect(both.sort()).toEqual(['get_workflow', 'get_workflow_run', 'list_workflows']);
      });
    });

    describe('agents parity', () => {
      it('call_agent returns the same reply as POST /agents/:agentId/generate', async () => {
        const result = await callTool('member-token', 'call_agent', { agentId: 'test-agent', message: 'hi' });
        expect(mcpOutcome(result)).toBe('ok');
        // Over HTTP the client must name a thread for this memory-backed agent; call_agent mints one.
        const httpResult = await http('member-token', 'POST', '/agents/test-agent/generate', {
          messages: [{ role: 'user', content: 'hi' }],
          memory: { thread: crypto.randomUUID(), resource: 'user-member' },
        });
        expect(httpResult.status).toBe(200);
        expect(payload(result).text).toBe(httpResult.body.text);
        expect(payload(result).runId).toEqual(expect.any(String));
      });

      it('denies a FGA-locked agent over MCP and HTTP', async () => {
        // Not in member's agentId enum; the server-side 403 is covered with the enum disabled below.
        const result = await callTool('member-token', 'call_agent', { agentId: 'locked-agent', message: 'hi' });
        expect(mcpOutcome(result)).toBe('invalid');
        const httpResult = await http('member-token', 'POST', '/agents/locked-agent/generate', {
          messages: [{ role: 'user', content: 'hi' }],
        });
        expect(httpResult.status).toBe(403);
        // The owner may call it both ways.
        expect(
          mcpOutcome(await callTool('owner-token', 'call_agent', { agentId: 'locked-agent', message: 'hi' })),
        ).toBe('ok');
      });

      it("enforces thread ownership: another user's thread is 403 over MCP and HTTP", async () => {
        const own = await callTool('member2-token', 'call_agent', {
          agentId: 'test-agent',
          message: 'remember this',
          resourceId: 'user-member2',
        });
        expect(mcpOutcome(own)).toBe('ok');
        const threadId = payload(own).threadId;
        expect(threadId).toEqual(expect.any(String));

        // Owner continues their own thread.
        expect(
          mcpOutcome(
            await callTool('member2-token', 'call_agent', { agentId: 'test-agent', message: 'again', threadId }),
          ),
        ).toBe('ok');

        const stolen = await callTool('member-token', 'call_agent', { agentId: 'test-agent', message: 'x', threadId });
        const httpStolen = await http('member-token', 'POST', '/agents/test-agent/generate', {
          messages: [{ role: 'user', content: 'x' }],
          memory: { thread: threadId, resource: 'user-member' },
        });
        expect(httpStolen.status).toBe(403);
        expect(mcpOutcome(stolen)).toBe(403);
      });
    });

    describe('workflows parity', () => {
      it('start_workflow suspends and resume_workflow_run completes, like the HTTP routes', async () => {
        const started = await callTool('member-token', 'start_workflow', {
          workflowId: 'test-workflow',
          inputData: { value: 'x' },
        });
        expect(mcpOutcome(started)).toBe('ok');
        const { status, runId, suspendPayload } = payload(started);
        expect(status).toBe('suspended');
        expect(suspendPayload).toBeDefined();

        const run = await http('member-token', 'GET', `/workflows/test-workflow/runs/${runId}`);
        expect(run.status).toBe(200);
        expect(run.body.status).toBe('suspended');

        const resumed = await callTool('member-token', 'resume_workflow_run', {
          workflowId: 'test-workflow',
          runId,
          step: 'approval',
          resumeData: { approved: true },
        });
        expect(mcpOutcome(resumed)).toBe('ok');
        expect(payload(resumed)).toMatchObject({ status: 'success', result: { approved: true } });
      });

      it('denies a FGA-locked workflow over MCP and HTTP', async () => {
        const result = await callTool('member-token', 'start_workflow', {
          workflowId: 'locked-workflow',
          inputData: { value: 'x' },
        });
        expect(mcpOutcome(result)).toBe('invalid');
        const httpResult = await http('member-token', 'POST', '/workflows/locked-workflow/start-async', {
          inputData: { value: 'x' },
        });
        expect(httpResult.status).toBe(403);
      });
    });

    describe('tools parity', () => {
      it('entity tool returns the same result as POST /tools/:toolId/execute', async () => {
        const result = await callTool('member-token', 'tool_test-tool', { text: 'hello' });
        const httpResult = await http('member-token', 'POST', '/tools/test-tool/execute', { data: { text: 'hello' } });
        expect(httpResult.status).toBe(200);
        expect(mcpOutcome(result)).toBe('ok');
        expect(payload(result)).toEqual(httpResult.body);
      });

      it('runs tools with the RequestContext the /mcp route authenticated', async () => {
        const result = await callTool('member-token', 'tool_whoami', {});
        expect(payload(result)).toEqual({ userId: 'user-member' });
      });

      it('denies a tool the caller lacks tools:execute for, over MCP and HTTP', async () => {
        const result = await callTool('no-tools-token', 'tool_test-tool', { text: 'x' });
        expect(mcpOutcome(result)).toBe('not offered');
        const httpResult = await http('no-tools-token', 'POST', '/tools/test-tool/execute', { data: { text: 'x' } });
        expect(httpResult.status).toBe(403);
      });
    });
  });

  describe(`${suiteName} — enums disabled (enumLimit: 0)`, () => {
    let server: Awaited<ReturnType<BuiltinMCPParityTestSuiteConfig['startServer']>>;
    const clients: MCPClient[] = [];
    beforeAll(async () => {
      server = await startServer(createParityMastra({ enumLimit: 0 }).mastra);
    });
    afterAll(async () => {
      await Promise.all(clients.map(client => client.disconnect()));
      await server?.close();
    });

    const tools = async (token: string) => {
      const client = new MCPClient({
        id: `mcp-enum-${token}-${clients.length}`,
        servers: {
          mastra: {
            url: new URL(`${server.url}/api/mcp`),
            requestInit: { headers: { authorization: `Bearer ${token}` } },
            onToolError: 'return',
          },
        },
      });
      clients.push(client);
      return client.listTools();
    };
    const http = (token: string, path: string, body: unknown) =>
      fetch(`${server.url}/api${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    const status = (result: ToolResult) =>
      result.error === true ? 'invalid' : result.isError ? Number(/(\d{3}) /.exec(resultText(result))?.[1]) : 'ok';

    it('switches registered tools to list_tools/get_tool/call_tool', async () => {
      const names = Object.keys(await tools('owner-token')).map(name => name.replace(/^mastra_/, ''));
      expect(names).toEqual(expect.arrayContaining(['list_tools', 'get_tool', 'call_tool']));
      expect(names.some(name => name.startsWith('tool_'))).toBe(false);
    });

    it('denies a FGA-locked agent, workflow, and tool with 403, exactly like HTTP', async () => {
      const list = await tools('member-token');
      const cases = [
        {
          tool: 'call_agent',
          args: { agentId: 'locked-agent', message: 'hi' },
          path: '/agents/locked-agent/generate',
          body: { messages: [{ role: 'user', content: 'hi' }] },
        },
        {
          tool: 'start_workflow',
          args: { workflowId: 'locked-workflow', inputData: { value: 'x' } },
          path: '/workflows/locked-workflow/start-async',
          body: { inputData: { value: 'x' } },
        },
        {
          tool: 'call_tool',
          args: { toolId: 'locked-tool', data: { text: 'x' } },
          path: '/tools/locked-tool/execute',
          body: { data: { text: 'x' } },
        },
      ];
      for (const c of cases) {
        const result = (await list[`mastra_${c.tool}`]!.execute!(c.args, {} as any)) as ToolResult;
        const httpStatus = (await http('member-token', c.path, c.body)).status;
        expect(httpStatus).toBe(403);
        expect(status(result)).toBe(httpStatus);
      }
      // And the owner is allowed both ways.
      const owner = await tools('owner-token');
      const ok = (await owner['mastra_call_tool']!.execute!(
        { toolId: 'locked-tool', data: { text: 'x' } },
        {} as any,
      )) as ToolResult;
      expect(status(ok)).toBe('ok');
    });
  });

  // Handlers resolve an agent, workflow, or tool by its `.id` or by the key it is registered under, so
  // include/exclude must match both, whichever one the config or the caller uses.
  describe(`${suiteName} — include/exclude match ids and registration keys`, () => {
    const running: Array<{ close: () => Promise<void> }> = [];
    const clients: MCPClient[] = [];
    afterAll(async () => {
      await Promise.all(clients.map(client => client.disconnect()));
      await Promise.all(running.map(server => server.close()));
    });

    const BY_ID = { agents: ['billing-agent'], workflows: ['greet-workflow'], tools: ['delete-account'] };
    const BY_KEY = { agents: ['billingAgent'], workflows: ['greetWorkflow'], tools: ['deleteAccountTool'] };
    const ALIASES = {
      agent: ['billing-agent', 'billingAgent'],
      workflow: ['greet-workflow', 'greetWorkflow'],
      tool: ['delete-account', 'deleteAccountTool'],
    };
    const KINDS = ['agent', 'workflow', 'tool'] as const;

    /** Serves the parity app plus one agent, workflow, and tool whose registration key differs from its id. */
    const serve = async (mcp: ServerMCPConfig) => {
      const { mastra, makeAgent, makeWorkflow, makeTool } = createParityMastra(mcp);
      mastra.addAgent(makeAgent('billing-agent', 'Bills customers'), 'billingAgent');
      mastra.addWorkflow(makeWorkflow('greet-workflow'), 'greetWorkflow');
      mastra.addTool(makeTool('delete-account'), 'deleteAccountTool');
      const started = await startServer(mastra);
      running.push(started);
      const client = new MCPClient({
        id: `mcp-alias-${clients.length}`,
        servers: {
          mastra: {
            url: new URL(`${started.url}/api/mcp`),
            requestInit: { headers: { authorization: 'Bearer owner-token' } },
            onToolError: 'return',
          },
        },
      });
      clients.push(client);
      const tools = Object.fromEntries(
        Object.entries(await client.listTools()).map(([name, tool]) => [name.replace(/^mastra_/, ''), tool]),
      );
      const run = async (name: string, args: Record<string, unknown>) =>
        tools[name] ? mcpOutcome((await tools[name].execute!(args, {} as any)) as ToolResult) : 'not offered';
      const listed = async (name: string, key: string): Promise<string[]> =>
        tools[name]
          ? payload((await tools[name].execute!({}, {} as any)) as ToolResult)[key].map((e: any) => e.id)
          : [];
      const call = {
        agent: (id: string) => run('call_agent', { agentId: id, message: 'hi' }),
        workflow: (id: string) => run('start_workflow', { workflowId: id, inputData: { value: 'x' } }),
        tool: (id: string) => run('call_tool', { toolId: id, data: { text: 'x' } }),
      };
      return { names: Object.keys(tools), run, listed, call };
    };

    for (const [label, exclude] of [
      ['by id', BY_ID],
      ['by registration key', BY_KEY],
    ] as const) {
      it(`exclude ${label} hides and refuses every alias above enumLimit`, async () => {
        const app = await serve({ exclude, enumLimit: 0, featured: { agents: BY_KEY.agents } });
        const aliases = Object.values(ALIASES).flat();
        for (const [tool, key] of [
          ['list_agents', 'agents'],
          ['list_workflows', 'workflows'],
          ['list_tools', 'tools'],
        ] as const) {
          const ids = await app.listed(tool, key);
          expect(ids.length).toBeGreaterThan(0);
          expect(ids.filter(id => aliases.includes(id))).toEqual([]);
        }
        expect(app.names.filter(name => /billing|greet|delete/i.test(name))).toEqual([]);
        for (const kind of KINDS) {
          for (const alias of ALIASES[kind]) expect([alias, await app.call[kind](alias)]).toEqual([alias, 404]);
        }
      });

      it(`exclude ${label} keeps every alias out of enums, entity tools, and featured tools`, async () => {
        const app = await serve({ exclude, featured: { agents: BY_KEY.agents, workflows: BY_ID.workflows } });
        expect(app.names).not.toContain('call_tool');
        expect(app.names.filter(name => /billing|greet|delete/i.test(name))).toEqual([]);
        // Not in the advertised enum, so the client rejects them before they reach the server.
        for (const kind of ['agent', 'workflow'] as const) {
          for (const alias of ALIASES[kind]) expect([alias, await app.call[kind](alias)]).toEqual([alias, 'invalid']);
        }
      });
    }

    for (const [label, include] of [
      ['by id', BY_ID],
      ['by registration key', BY_KEY],
    ] as const) {
      it(`include ${label} offers only them, callable by either alias`, async () => {
        const app = await serve({ include, enumLimit: 0 });
        expect(await app.listed('list_agents', 'agents')).toEqual(['billing-agent']);
        expect(await app.listed('list_workflows', 'workflows')).toEqual(['greetWorkflow']);
        expect(await app.listed('list_tools', 'tools')).toEqual(['delete-account']);
        for (const kind of KINDS) {
          for (const alias of ALIASES[kind]) expect([alias, await app.call[kind](alias)]).toEqual([alias, 'ok']);
        }
        expect(await app.call.agent('test-agent')).toBe(404);
        expect(await app.call.workflow('test-workflow')).toBe(404);
        expect(await app.call.tool('test-tool')).toBe(404);
      });

      it(`include ${label} names entity and featured tools from the id`, async () => {
        const app = await serve({ include, featured: { agents: include.agents, workflows: include.workflows } });
        expect(app.names).toEqual(
          expect.arrayContaining(['agent_billing-agent', 'workflow_greet-workflow', 'tool_delete-account']),
        );
        expect(app.names.filter(name => /^(agent|workflow|tool)_/.test(name)).sort()).toEqual([
          'agent_billing-agent',
          'tool_delete-account',
          'workflow_greet-workflow',
        ]);
        expect(await app.run('tool_delete-account', { text: 'x' })).toBe('ok');
        expect(await app.run('agent_billing-agent', { message: 'hi' })).toBe('ok');
      });
    }
  });

  describe(`${suiteName} — abort`, () => {
    it("aborts the agent's model call when the client aborts call_agent", async () => {
      let modelSignal: AbortSignal | undefined;
      let modelStarted!: () => void;
      const started = new Promise<void>(resolve => (modelStarted = resolve));
      // Never answers on its own; only an abort ends the call.
      const hang = async ({ abortSignal }: { abortSignal?: AbortSignal }): Promise<never> => {
        modelSignal = abortSignal;
        modelStarted();
        return new Promise((_, reject) => abortSignal?.addEventListener('abort', () => reject(abortSignal.reason)));
      };
      const model = new MastraLanguageModelV2Mock({ doGenerate: hang, doStream: hang });
      const { mastra, memory } = createParityMastra();
      mastra.addAgent(new Agent({ id: 'slow-agent', name: 'slow-agent', instructions: 'x', model, memory }));
      const running = await startServer(mastra);
      const client = new MCPClient({
        id: 'mcp-abort',
        servers: {
          mastra: {
            url: new URL(`${running.url}/api/mcp`),
            requestInit: { headers: { authorization: 'Bearer owner-token' } },
            onToolError: 'return',
          },
        },
      });
      try {
        const tools = await client.listTools();
        const controller = new AbortController();
        const call = tools['mastra_call_agent']!.execute!({ agentId: 'slow-agent', message: 'hi' }, {
          abortSignal: controller.signal,
        } as any).catch(error => error);
        await Promise.race([started, call]);
        expect(modelSignal?.aborted).toBe(false);
        controller.abort();
        await call;
        // The client closes the HTTP request; the adapter propagates the disconnect to the agent run.
        await expect.poll(() => modelSignal?.aborted, { timeout: 5000 }).toBe(true);
      } finally {
        await client.disconnect();
        await running.close();
      }
    }, 15_000);
  });

  describe(`${suiteName} — gating`, () => {
    const originalDev = process.env.MASTRA_DEV;
    afterEach(() => {
      if (originalDev === undefined) delete process.env.MASTRA_DEV;
      else process.env.MASTRA_DEV = originalDev;
    });

    const mcpStatus = async (mastra: Mastra, path = '/api/mcp', token?: string) => {
      const started = await startServer(mastra);
      try {
        const response = await fetch(`${started.url}${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '1' } },
          }),
        });
        return response.status;
      } finally {
        await started.close();
      }
    };

    it('is not served in a production build without server.auth', async () => {
      delete process.env.MASTRA_DEV;
      expect(await mcpStatus(new Mastra({ logger: false }))).toBe(404);
    });

    it('is served under mastra dev without auth, answering 2025-11-25 clients', async () => {
      process.env.MASTRA_DEV = 'true';
      expect(await mcpStatus(new Mastra({ logger: false }))).toBe(200);
    });

    it('is served without auth when enabled explicitly, and never when disabled', async () => {
      delete process.env.MASTRA_DEV;
      expect(await mcpStatus(new Mastra({ logger: false, server: { mcp: { enabled: true } } }))).toBe(200);
      process.env.MASTRA_DEV = 'true';
      expect(await mcpStatus(new Mastra({ logger: false, server: { mcp: { enabled: false } } }))).toBe(404);
    });

    // Node 22 makes a request body unreadable once a clone of that request is garbage collected. Adapters
    // clone the request to parse its JSON body, and the MCP transport reads the original afterwards.
    it('still reads the request body when garbage is collected before the transport runs', async () => {
      setFlagsFromString('--expose-gc');
      const collectGarbage = runInNewContext('gc') as () => void;
      class CollectingAuth extends SimpleAuth<TestUser> {
        async authenticateToken(...args: Parameters<SimpleAuth<TestUser>['authenticateToken']>) {
          for (let round = 0; round < 2; round++) {
            collectGarbage();
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return super.authenticateToken(...args);
        }
      }
      const auth = new CollectingAuth({ tokens: { ...USERS }, mapUserToResourceId: user => user.id });
      const mastra = new Mastra({ logger: false, server: { auth } });
      expect(await mcpStatus(mastra, '/api/mcp', Object.keys(USERS)[0])).toBe(200);
    });

    it('serves at server.mcp.path without shadowing the MCP server registry', async () => {
      process.env.MASTRA_DEV = 'true';
      const mastra = new Mastra({ logger: false, server: { mcp: { path: '/tools-mcp' } } });
      expect(await mcpStatus(mastra, '/api/tools-mcp')).toBe(200);
      const started = await startServer(mastra);
      try {
        expect((await fetch(`${started.url}/api/mcp/v0/servers`)).status).toBe(200);
      } finally {
        await started.close();
      }
    });
  });
}
