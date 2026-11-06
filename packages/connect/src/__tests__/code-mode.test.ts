import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { LocalSandbox } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { __clearSharedToolsStateForTests, tools as connect } from '../tools.js';
import type { ToolsOptions } from '../tools.js';

type Row = Record<string, unknown>;

function linearConnection(resourceId: string | null = null): Row {
  return { ...connection('linear', 'c_lin1'), resourceId };
}

function connection(integrationId: string, id: string): Row {
  return {
    id,
    integrationId,
    status: 'active',
    connectedByUserId: null,
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: null,
    resourceId: null,
  };
}

/**
 * Mastra Platform at the fetch boundary: a Linear + Slack catalog, a
 * connection list, and the Linear GraphQL API behind the connection proxy.
 * Everything between the agent and this fetch runs for real.
 */
function platform(connections: () => Row[]) {
  const graphql: string[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/integrations') {
      return Response.json({
        integrations: [
          { id: 'linear', capabilities: {}, displayName: 'Linear', authType: 'OAUTH2' },
          { id: 'slack', capabilities: {}, displayName: 'Slack', authType: 'OAUTH2' },
          { id: 'github', capabilities: {}, displayName: 'GitHub', authType: 'OAUTH2' },
          { id: 'stripe', capabilities: {}, displayName: 'Stripe', authType: 'OAUTH2' },
        ],
      });
    }
    if (url.pathname === '/v2/projects/proj_1/integration-settings') {
      return Response.json({ endUserProviders: null });
    }
    if (url.pathname === '/v2/projects/proj_1/connections') {
      const resourceId = url.searchParams.get('resourceId');
      return Response.json({
        connections: connections().filter(row => row.resourceId === null || row.resourceId === resourceId),
      });
    }
    if (url.pathname === '/v2/connections/c_lin1/proxy/graphql') {
      const { query } = JSON.parse(String(init?.body)) as { query: string };
      graphql.push(query);
      if (query.includes('teams(')) {
        return Response.json({
          data: {
            teams: {
              nodes: [
                { id: 't1', name: 'Engineering', key: 'ENG' },
                { id: 't2', name: 'Design', key: 'DES' },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });
      }
      return Response.json({ errors: [{ message: `unexpected query: ${query}` }] });
    }
    return new Response('not found', { status: 404 });
  });
  const options: ToolsOptions = {
    projectId: 'proj_1',
    client: { accessToken: 'fake-test-token', baseUrl: 'https://example.test', fetch: fetchMock as typeof fetch },
  };
  return { options, graphql };
}

type Chunk = Record<string, unknown>;
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function toolCall(toolName: string, input: unknown): Chunk[] {
  return [
    {
      type: 'tool-call',
      toolCallId: `call-${toolName}`,
      toolName,
      input: JSON.stringify(input),
      providerExecuted: false,
    },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ] as Chunk[];
}

const answer: Chunk[] = [
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: 'Done.' },
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: 'stop', usage },
] as Chunk[];

/** Model that plays `steps` in order and records what it was sent on each call. */
function scriptedModel(steps: Chunk[][]) {
  const calls: Array<{ prompt: unknown[]; tools: string[] }> = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt, tools }) => {
      calls.push({ prompt, tools: (tools ?? []).map(tool => tool.name) });
      const chunks = steps[calls.length - 1] ?? answer;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...chunks]) as never,
      };
    },
  });
  return { model, calls };
}

function codeModeAgent(code: ReturnType<ReturnType<typeof connect>['codeMode']>, model: MockLanguageModelV2) {
  const agent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: async ctx => ['You are helpful.', await code.instructions(ctx)],
    model,
    tools: code.tools,
  });
  new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
  return agent;
}

/** Streams one agent turn and returns every chunk. */
async function run(agent: Agent, prompt: string) {
  const stream = await agent.stream(prompt);
  const chunks: Array<{ type: string; payload?: any }> = [];
  for await (const chunk of stream.fullStream) chunks.push(chunk as { type: string; payload?: any });
  return chunks;
}

const systemPrompt = (call: { prompt: unknown[] }) =>
  JSON.stringify(call.prompt.filter(m => (m as Row).role === 'system'));
const toolResults = (call: { prompt: unknown[] }) =>
  JSON.stringify(call.prompt.filter(m => (m as Row).role === 'tool'));

afterEach(async () => {
  await __clearSharedToolsStateForTests();
});

describe('connect tools in code mode', () => {
  it('answers from Linear data and the agent’s own tools gathered in one program', async () => {
    const { options, graphql } = platform(() => [linearConnection()]);
    const getWeather = createTool({
      id: 'get_weather',
      description: 'Current weather for a city.',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ city: z.string(), tempC: z.number() }),
      execute: async ({ city }) => ({ city, tempC: 18 }),
    });
    const { model, calls } = scriptedModel([
      toolCall('execute_typescript', {
        code: `
          const [teams, weather] = await Promise.all([
            external_linear_list_teams({}),
            external_get_weather({ city: 'Paris' }),
          ]);
          return { teamNames: teams.items.map(t => t.name), weather };
        `,
      }),
    ]);
    const code = connect(options).with({ getWeather }).codeMode({ sandbox: new LocalSandbox() });

    const chunks = await run(codeModeAgent(code, model), 'Which Linear teams do we have, and is it warm in Paris?');

    expect(chunks.filter(c => c.type === 'text-delta').map(c => c.payload.text)).toEqual(['Done.']);
    // The model gets one orchestration tool instead of every provider tool,
    // and a typed declaration for each function it can call from the program.
    expect(calls[0]!.tools).toEqual(['execute_typescript']);
    expect(systemPrompt(calls[0]!)).toContain('declare function external_linear_list_teams(');
    expect(systemPrompt(calls[0]!)).toContain('declare function external_get_weather(');
    // The program's calls ran the real Linear tool through the platform proxy.
    expect(graphql).toHaveLength(1);
    expect(toolResults(calls[1]!)).toContain('"teamNames":["Engineering","Design"]');
    expect(toolResults(calls[1]!)).toContain('"tempC":18');
  });

  describe('when a Linear tool requires the user’s approval', () => {
    const approvalOptions = (base: ToolsOptions): ToolsOptions => ({
      ...base,
      requireApproval: ['linear_delete_issue'],
    });

    it('keeps it out of the program so it cannot run unapproved', async () => {
      const { options, graphql } = platform(() => [linearConnection()]);
      const { model, calls } = scriptedModel([
        toolCall('execute_typescript', { code: `return await external_linear_delete_issue({ id: 'LIN-1' });` }),
      ]);
      const code = connect(approvalOptions(options)).codeMode({ sandbox: new LocalSandbox() });

      await run(codeModeAgent(code, model), 'Delete LIN-1');

      expect(systemPrompt(calls[0]!)).not.toContain('external_linear_delete_issue(');
      expect(toolResults(calls[1]!)).toContain('external_linear_delete_issue is not defined');
      expect(graphql).toEqual([]);
    });

    it('offers it to the model directly, where the run waits for approval', async () => {
      const { options, graphql } = platform(() => [linearConnection()]);
      const { model, calls } = scriptedModel([toolCall('linear_delete_issue', { id: 'LIN-1' })]);
      const code = connect(approvalOptions(options)).codeMode({ sandbox: new LocalSandbox() });

      const chunks = await run(codeModeAgent(code, model), 'Delete LIN-1');
      const approvals = chunks.filter(c => c.type === 'tool-call-approval').map(c => c.payload.toolName);

      expect(calls[0]!.tools.sort()).toEqual(['execute_typescript', 'linear_delete_issue']);
      expect(approvals).toEqual(['linear_delete_issue']);
      expect(graphql).toEqual([]);
    });
  });

  it('lets the agent pause on a connect card for a provider the user has not connected', async () => {
    const { options } = platform(() => [linearConnection()]);
    const { model, calls } = scriptedModel([toolCall('request_connection', { provider: 'slack' })]);
    const code = connect({ ...options, resourceId: 'end-user-42' }).codeMode({ sandbox: new LocalSandbox() });

    const chunks = await run(codeModeAgent(code, model), 'Post this to Slack');
    const suspended = chunks.filter(c => c.type === 'tool-call-suspended').map(c => c.payload.suspendPayload);

    // request_connection suspends the agent run, which only works as a direct
    // tool: inside the program there is no run to pause.
    expect(calls[0]!.tools.sort()).toEqual(['execute_typescript', 'request_connection']);
    expect(systemPrompt(calls[0]!)).not.toContain('external_request_connection');
    expect(suspended).toEqual([expect.objectContaining({ type: 'connect-prompt', requestedProvider: 'slack' })]);
  });

  it('only declares functions the program can call when a connection is removed mid-request', async () => {
    // With no cache, the instructions and the tools would each resolve the
    // connection list on their own; the first sees Linear, the second does not.
    let fetches = 0;
    const { options, graphql } = platform(() => (fetches++ === 0 ? [linearConnection()] : []));
    const { model, calls } = scriptedModel([
      toolCall('execute_typescript', {
        code: `const teams = await external_linear_list_teams({}); return teams.items.length;`,
      }),
    ]);
    const code = connect({ ...options, ttlMs: 0 }).codeMode({ sandbox: new LocalSandbox() });

    await run(codeModeAgent(code, model), 'How many Linear teams?');

    expect(systemPrompt(calls[0]!)).toContain('declare function external_linear_list_teams(');
    expect(calls[0]!.tools).toEqual(['execute_typescript']);
    expect(toolResults(calls[1]!)).toContain('"result":2');
    expect(graphql).toHaveLength(1);
  });

  it('adds nothing when the project has no connections', async () => {
    const { options } = platform(() => []);
    const code = connect(options).codeMode({ sandbox: new LocalSandbox() });

    expect(await code.tools()).toEqual({});
    expect(await code.instructions()).toBe('');
  });

  describe('with tool search', () => {
    const manyProviders = () => [linearConnection(), connection('github', 'c_gh1'), connection('stripe', 'c_str1')];

    it('lets the model look up the functions it needs, then call them from a program', async () => {
      const { options, graphql } = platform(() => [linearConnection()]);
      const { model, calls } = scriptedModel([
        toolCall('search_functions', { query: 'list linear teams' }),
        toolCall('execute_typescript', {
          code: `const teams = await external_linear_list_teams({}); return teams.items.map(t => t.key);`,
        }),
      ]);
      const code = connect(options).codeMode({ sandbox: new LocalSandbox(), toolSearch: true });

      await run(codeModeAgent(code, model), 'Which Linear teams do we have?');

      // Only names go in the instructions; declarations come from the search.
      expect(calls[0]!.tools.sort()).toEqual(['execute_typescript', 'search_functions']);
      expect(systemPrompt(calls[0]!)).toContain('external_linear_list_teams');
      expect(systemPrompt(calls[0]!)).not.toContain('declare function');
      const found = toolResults(calls[1]!);
      expect(found).toContain('declare function external_linear_list_teams(');
      expect(found).not.toContain('external_linear_archive_cycle');
      // Undeclared functions are still callable from the program.
      expect(toolResults(calls[2]!)).toContain('"result":["ENG","DES"]');
      expect(graphql).toHaveLength(1);
    });

    it('returns exactly the functions asked for by name', async () => {
      const { options } = platform(() => [linearConnection()]);
      const names = ['linear_create_issue', 'linear_get_cycle', 'linear_list_users', 'linear_unarchive_project'];
      const { model, calls } = scriptedModel([
        toolCall('search_functions', { query: names.map(name => `external_${name}`).join(' '), limit: 4 }),
      ]);
      const code = connect(options).codeMode({ sandbox: new LocalSandbox(), toolSearch: true });

      await run(codeModeAgent(code, model), 'Look up these functions');

      const found = [...toolResults(calls[1]!).matchAll(/declare function external_(\w+)\(/g)].map(m => m[1]);
      expect(found).toEqual(names);
    });

    it('turns on by itself when declaring every function would flood the context', async () => {
      const { options } = platform(manyProviders);
      const code = connect(options).codeMode({ sandbox: new LocalSandbox() });

      const instructions = await code.instructions();
      expect(Object.keys(await code.tools()).sort()).toEqual(['execute_typescript', 'search_functions']);
      expect(instructions).not.toContain('declare function');
      expect(instructions).toContain('external_github_');
      expect(instructions).toContain('external_stripe_');
    });

    it('declares everything up front when turned off', async () => {
      const { options } = platform(manyProviders);
      const code = connect(options).codeMode({ sandbox: new LocalSandbox(), toolSearch: false });

      expect(Object.keys(await code.tools())).toEqual(['execute_typescript']);
      expect(await code.instructions()).toContain('declare function external_stripe_');
    });
  });
});
