import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { ServerMCPConfig } from '@mastra/core/server';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { buildBuiltinMCPTools, nameEntityTools } from './catalogue';
import { resolveBuiltinMCPConfig } from './config';
import { BUILTIN_MCP_HTTP_ROUTE } from './route';

const agent = (id: string, description?: string) =>
  new Agent({ id, name: id, description, instructions: 'test', model: 'openai/gpt-4o-mini' });

const workflow = (id: string) => {
  const step = createStep({
    id: 'step',
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.object({ city: z.string() }),
    execute: async ({ inputData }) => inputData,
  });
  return createWorkflow({
    id,
    description: `${id} workflow`,
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.object({ city: z.string() }),
  })
    .then(step)
    .commit();
};

const tool = (id: string) =>
  createTool({
    id,
    description: `${id} tool`,
    inputSchema: z.object({ text: z.string() }),
    execute: async ({ text }) => ({ text }),
  });

function setup({
  agents = {},
  workflows = {},
  tools = {},
  mcp = {},
  editor,
}: {
  editor?: any;
  agents?: Record<string, Agent>;
  workflows?: Record<string, ReturnType<typeof workflow>>;
  tools?: Record<string, ReturnType<typeof tool>>;
  mcp?: ServerMCPConfig;
}) {
  const mastra = new Mastra({
    agents,
    workflows,
    tools,
    storage: new InMemoryStore(),
    logger: false,
    server: { mcp },
    editor,
  });
  const build = async (request?: Request) =>
    buildBuiltinMCPTools(
      {
        mastra,
        requestContext: new RequestContext(),
        abortSignal: new AbortController().signal,
        mcpRoute: BUILTIN_MCP_HTTP_ROUTE,
      },
      resolveBuiltinMCPConfig(mastra, request),
    );
  return { mastra, build };
}

const enumOf = (tools: Record<string, any>, name: string, param: string) =>
  tools[name]?.inputSchema && (toJSON(tools[name].inputSchema).properties?.[param]?.enum as string[] | undefined);

function toJSON(schema: any): any {
  // createTool keeps plain JSON Schema as given (wrapped by the schema-compat layer when needed).
  return schema?.jsonSchema ?? schema?.['~standard']?.jsonSchema?.input?.({ target: 'draft-07' }) ?? schema;
}

describe('nameEntityTools', () => {
  it('sanitizes ids and keeps valid ids un-hashed when a sanitized id collides', () => {
    const names = nameEntityTools('tool', ['a.b', 'a_b'], new Set());
    expect(names.get('a_b')).toBe('tool_a_b');
    expect(names.get('a.b')).toMatch(/^tool_a_b_[0-9a-f]{6}$/);
  });

  it('truncates long ids to 64 characters with a deterministic hash suffix', () => {
    const id = 'x'.repeat(100);
    const first = nameEntityTools('agent', [id], new Set()).get(id)!;
    const second = nameEntityTools('agent', [id], new Set()).get(id)!;
    expect(first).toHaveLength(64);
    expect(first).toBe(second);
    const other = nameEntityTools('agent', [`${'x'.repeat(99)}y`], new Set()).get(`${'x'.repeat(99)}y`)!;
    expect(other).not.toBe(first);
  });

  it('avoids names already taken by operation tools', () => {
    const used = new Set(['tool_list']);
    expect(nameEntityTools('tool', ['list'], used).get('list')).toMatch(/^tool_list_[0-9a-f]{6}$/);
  });
});

describe('buildBuiltinMCPTools', () => {
  it('offers per-caller enums up to enumLimit, then falls back to plain ids and list/get/call tools', async () => {
    const atLimit = setup({
      agents: { a: agent('a', 'A'), b: agent('b', 'B') },
      tools: { t1: tool('t1'), t2: tool('t2') },
      mcp: { enumLimit: 2 },
    });
    const tools = await atLimit.build();
    expect(enumOf(tools, 'call_agent', 'agentId')).toEqual(['a', 'b']);
    expect(Object.keys(tools)).toEqual(expect.arrayContaining(['tool_t1', 'tool_t2']));
    expect(tools.call_tool).toBeUndefined();

    const above = setup({
      agents: { a: agent('a', 'A'), b: agent('b', 'B'), c: agent('c', 'C') },
      tools: { t1: tool('t1'), t2: tool('t2'), t3: tool('t3') },
      mcp: { enumLimit: 2 },
    });
    const aboveTools = await above.build();
    expect(enumOf(aboveTools, 'call_agent', 'agentId')).toBeUndefined();
    expect(Object.keys(aboveTools)).toEqual(expect.arrayContaining(['list_tools', 'get_tool', 'call_tool']));
    expect(Object.keys(aboveTools).some(name => name.startsWith('tool_'))).toBe(false);
  });

  it('applies include/exclude by primitive id to enums, lists, entity tools, and calls (exclude wins)', async () => {
    const { build } = setup({
      agents: { a: agent('a', 'A'), b: agent('b', 'B'), c: agent('c', 'C') },
      tools: { t1: tool('t1'), t2: tool('t2') },
      mcp: { include: { agents: ['a', 'b'] }, exclude: { agents: ['b'], tools: ['t2'] }, featured: { agents: ['b'] } },
    });
    const tools = await build();
    expect(enumOf(tools, 'call_agent', 'agentId')).toEqual(['a']);
    expect(tools.agent_b).toBeUndefined();
    expect(tools.tool_t1).toBeDefined();
    expect(tools.tool_t2).toBeUndefined();

    const listed = (await tools.list_agents!.execute!({}, {} as any)) as { agents: { id: string }[] };
    expect(listed.agents.map(a => a.id)).toEqual(['a']);
    // Without an enum to reject it up front, an excluded id is "not found" on call.
    const { build: buildNoEnum } = setup({
      agents: { a: agent('a', 'A'), c: agent('c', 'C') },
      mcp: { enumLimit: 0, exclude: { agents: ['c'] } },
    });
    const noEnum = await buildNoEnum();
    await expect(noEnum.get_agent!.execute!({ agentId: 'c' }, {} as any)).rejects.toThrow(/404 Agent not found/);
    await expect(noEnum.call_agent!.execute!({ agentId: 'c', message: 'hi' }, {} as any)).rejects.toThrow(
      /404 Agent not found/,
    );
  });

  it('builds featured entity tools, using the workflow input schema as the tool schema', async () => {
    const { build } = setup({
      agents: { support: agent('support', 'Support agent') },
      workflows: { weather: workflow('weather') },
      mcp: { featured: { agents: ['support', 'missing'], workflows: ['weather'] } },
    });
    const tools = await build();
    expect(tools.agent_support?.description).toBe('Support agent');
    expect(tools.agent_missing).toBeUndefined();
    expect(toJSON(tools.workflow_weather?.inputSchema).properties).toHaveProperty('city');

    const result = (await tools.workflow_weather!.execute!({ city: 'Paris' }, {} as any)) as any;
    expect(result).toMatchObject({ status: 'success', result: { city: 'Paris' } });
    expect(result.runId).toEqual(expect.any(String));
  });

  it('gives agents without a description a generic one and warns once', async () => {
    const { mastra, build } = setup({ agents: { quiet: agent('quiet') }, mcp: { featured: { agents: ['quiet'] } } });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const tools = await build();
    await build();
    expect(tools.agent_quiet?.description).toBe('Call the quiet agent.');
    expect(warn.mock.calls.filter(([message]) => String(message).includes('"quiet" has no description'))).toHaveLength(
      1,
    );
  });

  it('keeps only read-backed tools in read-only mode and derives readOnlyHint from the same fact', async () => {
    const { build } = setup({ agents: { a: agent('a', 'A') }, workflows: { w: workflow('w') }, mcp: {} });
    const all = await build();
    expect(all.list_agents?.mcp?.annotations?.readOnlyHint).toBe(true);
    expect(all.call_agent?.mcp?.annotations?.readOnlyHint).toBe(false);
    expect(all.cancel_workflow_run?.mcp?.annotations?.destructiveHint).toBe(true);

    const readOnly = await build(new Request('http://localhost/api/mcp?readonly=1'));
    for (const t of Object.values(readOnly)) expect(t.mcp?.annotations?.readOnlyHint).toBe(true);
    expect(Object.keys(readOnly).sort()).toEqual([
      'get_agent',
      'get_tool',
      'get_workflow',
      'get_workflow_run',
      'list_agents',
      'list_tools',
      'list_workflows',
    ]);
  });

  it('narrows toolsets per request but never widens the configured set', async () => {
    const { build } = setup({ agents: { a: agent('a', 'A') }, mcp: { toolsets: ['agents', 'tools'] } });
    const narrowed = await build(
      new Request('http://localhost/api/mcp?toolsets=agents,workflows', { headers: { 'x-mcp-toolsets': 'agents' } }),
    );
    expect(Object.keys(narrowed).sort()).toEqual(['call_agent', 'get_agent', 'list_agents']);
    const widened = await build(new Request('http://localhost/api/mcp?toolsets=workflows'));
    expect(Object.keys(widened)).toEqual([]);
  });

  it('tracks agents added after startup', async () => {
    const { mastra, build } = setup({ agents: { a: agent('a', 'A') } });
    expect(enumOf(await build(), 'call_agent', 'agentId')).toEqual(['a']);
    mastra.addAgent(agent('late', 'Late'), 'late');
    expect(enumOf(await build(), 'call_agent', 'agentId')).toEqual(['a', 'late']);
  });

  it('lists and calls stored agents through the same routes as HTTP', async () => {
    const stored = new Agent({
      id: 'stored-helper',
      name: 'Stored helper',
      description: 'Built in the agent builder',
      instructions: 'test',
      model: createMockModel({ mockText: 'hello from storage' }),
    });
    const editor = {
      agent: {
        list: async () => ({ agents: [{ id: 'stored-helper' }] }),
        getById: async (id: string) => (id === 'stored-helper' ? stored : null),
        applyStoredOverrides: async (agent: Agent) => agent,
      },
    };
    const { build } = setup({ agents: { a: agent('a', 'A') }, editor });
    const tools = await build();
    expect(enumOf(tools, 'call_agent', 'agentId')).toEqual(['a', 'stored-helper']);
    const result = (await tools.call_agent!.execute!({ agentId: 'stored-helper', message: 'hi' }, {} as any)) as any;
    expect(result.text).toBe('hello from storage');
    expect(result.runId).toEqual(expect.any(String));
  });
});
