import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import type { RoleDefinition } from '@mastra/core/auth/ee';
import { StaticRBACProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MastraEditor } from './index';

type User = { id: string; role: string };

const USERS: Record<string, User> = {
  alice: { id: 'alice', role: 'builder' },
  bob: { id: 'bob', role: 'builder' },
  viewer: { id: 'viewer', role: 'viewer' },
};

const ROLES: RoleDefinition[] = [
  { id: 'builder', name: 'Builder', permissions: ['*:read', '*:execute', 'stored-agents:write'] },
  { id: 'viewer', name: 'Viewer', permissions: ['*:read', 'mcp:execute'] },
];

const ALLOWED_MODEL = { provider: 'openai', name: 'gpt-4o-mini' };
const DENIED_MODEL = { provider: 'anthropic', name: 'claude-sonnet-4-5' };
const RULES = { operator: 'AND', conditions: [{ field: 'tier', operator: 'equals', value: 'pro' }] };

type ToolResult = { isError?: boolean; content?: Array<{ text?: string }>; structuredContent?: any };

const text = (result: ToolResult) => (result.content ?? []).map(part => part.text ?? '').join('');
const payload = (result: ToolResult) => result.structuredContent ?? JSON.parse(text(result));

/**
 * The built-in `/api/mcp` stored_agents toolset against a real MastraEditor, LibSQL storage, Hono server and
 * MCP client: same ownership and permissions as `/api/stored/agents`, plus the builder model policy.
 */
describe('built-in MCP stored_agents toolset', () => {
  let dir: string;
  let url: string;
  let close: () => Promise<void>;
  let editor: MastraEditor;
  const clients: MCPClient[] = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcp-stored-agents-'));
    const storage = new LibSQLStore({ id: 'mcp-stored-agents', url: `file:${join(dir, 'mastra.db')}` });
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        helper: new Agent({ id: 'helper', name: 'helper', instructions: 'test', model: 'openai/gpt-4o-mini' }),
      },
      editor: (editor = new MastraEditor({
        builder: {
          features: { agent: { model: true } },
          configuration: { agent: { models: { allowed: [{ provider: 'openai', modelId: 'gpt-4o-mini' }] } } },
        },
      })),
      server: {
        auth: new SimpleAuth<User>({ tokens: USERS, mapUserToResourceId: user => user.id }),
        rbac: new StaticRBACProvider<User>({ roles: ROLES, getUserRoles: user => [user.role] }),
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    url = `http://localhost:${address.port}`;
    close = () => new Promise<void>(resolve => server.close(() => resolve()));
  });

  afterAll(async () => {
    await Promise.all(clients.map(client => client.disconnect()));
    await close?.();
    await rm(dir, { recursive: true, force: true });
  });

  const tools = async (token: string) => {
    const client = new MCPClient({
      id: `stored-agents-${token}-${clients.length}`,
      servers: {
        mastra: {
          url: new URL(`${url}/api/mcp?toolsets=agents,stored_agents`),
          requestInit: { headers: { authorization: `Bearer ${token}` } },
          onToolError: 'return',
        },
      },
    });
    clients.push(client);
    const list = await client.listTools();
    return Object.fromEntries(Object.entries(list).map(([name, tool]) => [name.replace(/^mastra_/, ''), tool]));
  };

  const callTool = async (token: string, name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const tool = (await tools(token))[name];
    if (!tool) return { isError: true, content: [{ text: 'not offered' }] };
    return (await tool.execute!(args, {} as any)) as ToolResult;
  };

  const http = async (token: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${url}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json().catch(() => undefined) };
  };

  /** HTTP status carried in an MCP tool error (`<status> <message>`). */
  const status = (result: ToolResult) => (result.isError ? Number(/(\d{3}) /.exec(text(result))?.[1] ?? 500) : 200);

  // Explicit memory: omitting it on create applies the builder default (OM on its default model), which the policy rejects.
  const agentBody = (id: string, model = ALLOWED_MODEL) => ({
    id,
    name: id,
    instructions: 'Be brief.',
    model,
    memory: { options: { lastMessages: 10 } },
  });

  it('offers only reads to a caller without stored-agents:write, which HTTP also denies', async () => {
    expect(Object.keys(await tools('viewer')).sort()).toEqual([
      'get_agent',
      'get_stored_agent',
      'list_agents',
      'list_available_models',
      'list_stored_agents',
    ]);
    expect(text(await callTool('viewer', 'create_stored_agent', agentBody('viewer-agent')))).toBe('not offered');
    expect((await http('viewer', 'POST', '/stored/agents', agentBody('viewer-agent'))).status).toBe(403);
  });

  it('lists only the models the builder policy allows', async () => {
    const result = payload(await callTool('alice', 'list_available_models', {}));
    const providers = result.providers as Array<{ id: string; models: string[] }>;
    expect(providers.map(provider => provider.id)).toEqual(['openai']);
    expect(providers[0]!.models).toEqual(['gpt-4o-mini']);
  });

  it('rejects a model outside the builder policy (the HTTP route leaves this to the Studio picker)', async () => {
    const denied = await callTool('alice', 'create_stored_agent', agentBody('denied-agent', DENIED_MODEL));
    expect(status(denied)).toBe(422);
    expect(text(denied)).toContain('list_available_models');
    expect((await http('alice', 'GET', '/stored/agents/denied-agent')).status).toBe(404);

    const updated = await callTool('alice', 'update_stored_agent', { storedAgentId: 'helper', model: DENIED_MODEL });
    expect(status(updated)).toBe(422);
  });

  it('applies the builder policy to the fallback model list', async () => {
    const entry = (id: string, provider: string, modelId: string, enabled = true) => ({
      id,
      provider,
      modelId,
      enabled,
      maxRetries: 0,
    });
    const allowedEntry = entry('primary', 'openai', 'gpt-4o-mini');
    const deniedEntry = entry('fallback', 'anthropic', 'claude-sonnet-4-5');

    const denied = await callTool('alice', 'create_stored_agent', {
      ...agentBody('denied-fallback'),
      modelList: [allowedEntry, deniedEntry],
    });
    expect(status(denied)).toBe(422);
    expect(text(denied)).toContain('modelList[1]');
    expect(text(denied)).toContain('anthropic');
    expect((await http('alice', 'GET', '/stored/agents/denied-fallback')).status).toBe(404);

    // A disabled entry never runs, so it is not checked.
    const allowed = await callTool('alice', 'create_stored_agent', {
      ...agentBody('allowed-fallback'),
      modelList: [allowedEntry, { ...deniedEntry, enabled: false }],
    });
    expect(allowed.isError, text(allowed)).toBeFalsy();

    const updated = await callTool('alice', 'update_stored_agent', {
      storedAgentId: 'allowed-fallback',
      modelList: [allowedEntry, deniedEntry],
    });
    expect(status(updated)).toBe(422);
    const stored = await http('alice', 'GET', '/stored/agents/allowed-fallback');
    expect(stored.body.modelList).toEqual([allowedEntry, { ...deniedEntry, enabled: false }]);
  });

  it('applies the builder policy to the memory models too (observer, reflector, title; static and conditional)', async () => {
    const denied = 'anthropic/claude-sonnet-4-5';
    const memories = [
      { observationalMemory: { model: denied } },
      { observationalMemory: { observation: { model: denied } } },
      { type: 'inline', config: { observationalMemory: { reflection: { model: denied } } } },
      { options: { generateTitle: { model: denied } } },
      [{ value: { observationalMemory: true } }, { value: { observationalMemory: { model: denied } }, rules: RULES }],
    ];
    for (const [index, memory] of memories.entries()) {
      const id = `denied-memory-${index}`;
      const created = await callTool('alice', 'create_stored_agent', { ...agentBody(id), memory });
      expect(status(created), JSON.stringify(memory)).toBe(422);
      expect(text(created)).toContain('list_available_models');
      expect((await http('alice', 'GET', `/stored/agents/${id}`)).status).toBe(404);
    }
    const updated = await callTool('alice', 'update_stored_agent', { storedAgentId: 'helper', memory: memories[0] });
    expect(status(updated)).toBe(422);

    const allowed = await callTool('alice', 'create_stored_agent', {
      ...agentBody('allowed-memory'),
      memory: { observationalMemory: { model: 'openai/gpt-4o-mini' } },
    });
    expect(allowed.isError).toBeFalsy();
  });

  it('rejects memory that would run Observational Memory on an implicit default model', async () => {
    // The editor runs `observationalMemory: true` on its builder default model, and an OM config without a model
    // on OM's automatic pick; omitting memory on create applies the builder default (OM on). None is on the list.
    const cases: Array<[unknown, string]> = [
      [{ type: 'inline', config: { observationalMemory: true } }, 'memory.config.observationalMemory'],
      [{ observationalMemory: {} }, 'memory.observationalMemory'],
      [{ observationalMemory: { observation: { messageTokens: 50 } } }, 'memory.observationalMemory'],
      [{ observationalMemory: { model: 'default' } }, 'memory.observationalMemory'],
      [
        [{ value: { observationalMemory: { observation: { messageTokens: 50 } } } }],
        'memory[0].value.observationalMemory',
      ],
      [undefined, 'memory'],
    ];
    for (const [index, [memory, field]] of cases.entries()) {
      const id = `implicit-memory-${index}`;
      const created = await callTool('alice', 'create_stored_agent', { ...agentBody(id), memory });
      expect(status(created), JSON.stringify(memory)).toBe(422);
      expect(text(created)).toContain(`${field}:`);
      expect(text(created)).toContain('Allowed models: openai/gpt-4o-mini');
      expect((await http('alice', 'GET', `/stored/agents/${id}`)).status).toBe(404);
    }
    const updated = await callTool('alice', 'update_stored_agent', {
      storedAgentId: 'helper',
      memory: { observationalMemory: true },
    });
    expect(status(updated)).toBe(422);
    expect(text(updated)).toContain('memory.observationalMemory:');

    // An explicit allowed model on either step covers both observer and reflector; disabled OM runs no model.
    for (const [index, memory] of [
      { observationalMemory: { observation: { model: 'openai/gpt-4o-mini', messageTokens: 50 } } },
      { observationalMemory: false, options: { lastMessages: 10 } },
    ].entries()) {
      const created = await callTool('alice', 'create_stored_agent', {
        ...agentBody(`explicit-memory-${index}`),
        memory,
      });
      expect(created.isError, `${JSON.stringify(memory)}: ${text(created)}`).toBeFalsy();
    }
  });

  it('applies the builder policy to processor models (input/output; static, conditional and nested graph steps)', async () => {
    const denied = 'anthropic/claude-sonnet-4-5';
    const step = (model: unknown, providerId = 'moderation') => ({
      type: 'step',
      step: {
        id: `${providerId}-step`,
        providerId,
        config: model === undefined ? {} : { model },
        enabledPhases: ['processInput'],
      },
    });
    const graph = (...steps: unknown[]) => ({ steps });
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ inputProcessors: graph(step(denied)) }, 'inputProcessors.steps[0].step.config.model'],
      [{ outputProcessors: graph(step(denied, 'pii-detector')) }, 'outputProcessors.steps[0].step.config.model'],
      [
        { inputProcessors: [{ value: graph() }, { value: graph(step(denied)), rules: RULES }] },
        'inputProcessors[1].value.steps[0].step.config.model',
      ],
      [
        { inputProcessors: graph({ type: 'parallel', branches: [[step('openai/gpt-4o-mini')], [step(denied)]] }) },
        'inputProcessors.steps[0].branches[1][0].step.config.model',
      ],
      [
        {
          outputProcessors: graph({
            type: 'conditional',
            conditions: [{ steps: [{ type: 'parallel', branches: [[step(denied)]] }], rules: RULES }],
          }),
        },
        'outputProcessors.steps[0].conditions[0].steps[0].branches[0][0].step.config.model',
      ],
      // A built-in provider that needs a model, without one: implicit, so rejected.
      [{ inputProcessors: graph(step(undefined)) }, 'inputProcessors.steps[0].step.config.model'],
      // A provider the policy can't introspect: any string `model` is checked, any other `model` value rejected.
      [{ inputProcessors: graph(step(denied, 'custom-provider')) }, 'inputProcessors.steps[0].step.config.model'],
      [
        { inputProcessors: graph(step({ id: denied }, 'custom-provider')) },
        'inputProcessors.steps[0].step.config.model',
      ],
      // Explicit strings the policy can't parse into a provider/model fail closed.
      [{ inputProcessors: graph(step('gpt-4o-mini')) }, 'inputProcessors.steps[0].step.config.model'],
      [{ memory: { observationalMemory: { model: '' } } }, 'memory.observationalMemory.model'],
      [{ memory: { observationalMemory: { model: '/openai/gpt-4o-mini' } } }, 'memory.observationalMemory.model'],
    ];
    for (const [index, [fields, field]] of cases.entries()) {
      const id = `denied-processor-${index}`;
      const created = await callTool('alice', 'create_stored_agent', { ...agentBody(id), ...fields });
      expect(status(created), JSON.stringify(fields)).toBe(422);
      expect(text(created)).toContain(`${field}:`);
      expect(text(created)).toContain('list_available_models');
      expect((await http('alice', 'GET', `/stored/agents/${id}`)).status).toBe(404);
    }
    const updated = await callTool('alice', 'update_stored_agent', {
      storedAgentId: 'helper',
      outputProcessors: graph(step(denied)),
    });
    expect(status(updated)).toBe(422);
    expect(text(updated)).toContain('outputProcessors.steps[0].step.config.model:');

    // Allowed models pass, and providers that run no model need none.
    const allowed = await callTool('alice', 'create_stored_agent', {
      ...agentBody('allowed-processors'),
      inputProcessors: graph(step('openai/gpt-4o-mini'), step(undefined, 'unicode-normalizer')),
      outputProcessors: [{ value: graph(step('openai/gpt-4o-mini', 'pii-detector')), rules: RULES }],
    });
    expect(allowed.isError, text(allowed)).toBeFalsy();
  }, 30_000);

  it('fails closed when the builder model policy cannot be resolved', async () => {
    const resolveBuilder = editor.resolveBuilder;
    editor.resolveBuilder = async () => {
      throw new Error('builder unavailable');
    };
    try {
      const created = await callTool('alice', 'create_stored_agent', agentBody('unresolved-policy'));
      expect(status(created)).toBe(503);
      const updated = await callTool('alice', 'update_stored_agent', { storedAgentId: 'helper', model: DENIED_MODEL });
      expect(status(updated)).toBe(503);
    } finally {
      editor.resolveBuilder = resolveBuilder;
    }
    expect((await http('alice', 'GET', '/stored/agents/unresolved-policy')).status).toBe(404);
  });

  it('creates a published agent the creator can call right away, and keeps it private from others', async () => {
    const created = await callTool('alice', 'create_stored_agent', agentBody('alice-agent'));
    expect(created.isError).toBeFalsy();
    expect(payload(created)).toMatchObject({ id: 'alice-agent', authorId: 'alice', status: 'published' });

    // Published right away, so it is one of the agents its author can call.
    expect(JSON.stringify(payload(await callTool('alice', 'list_agents', {})))).toContain('alice-agent');

    // Bob gets what HTTP gives him: not found, and nothing in his list.
    const viaHttp = await http('bob', 'GET', '/stored/agents/alice-agent');
    expect(viaHttp.status).toBe(404);
    expect(status(await callTool('bob', 'get_stored_agent', { storedAgentId: 'alice-agent' }))).toBe(viaHttp.status);

    const bobList = payload(await callTool('bob', 'list_stored_agents', {}));
    expect(bobList.agents.map((agent: { id: string }) => agent.id)).not.toContain('alice-agent');
    const bobHttpList = await http('bob', 'GET', '/stored/agents');
    expect(bobHttpList.body.agents.map((agent: { id: string }) => agent.id)).not.toContain('alice-agent');

    const bobUpdate = await http('bob', 'PATCH', '/stored/agents/alice-agent', { instructions: 'hijacked' });
    expect(
      status(await callTool('bob', 'update_stored_agent', { storedAgentId: 'alice-agent', instructions: 'hijacked' })),
    ).toBe(bobUpdate.status);
    expect(bobUpdate.status).toBe(404);

    const aliceGet = payload(await callTool('alice', 'get_stored_agent', { storedAgentId: 'alice-agent' }));
    expect(aliceGet.instructions).toBe('Be brief.');
  });

  it('updates and publishes the change by default', async () => {
    const updated = await callTool('alice', 'update_stored_agent', {
      storedAgentId: 'alice-agent',
      instructions: 'Be very brief.',
    });
    expect(updated.isError).toBeFalsy();
    const viaHttp = await http('alice', 'GET', '/stored/agents/alice-agent?status=published');
    expect(viaHttp.body.instructions).toBe('Be very brief.');
  });
});
