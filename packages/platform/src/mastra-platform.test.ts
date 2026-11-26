import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { MastraServer } from '@mastra/hono';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MastraPlatform } from './index';

const PROJECT_ID = 'proj_123';
// A project access token is a JWT naming its project; the Platform verifies the signature.
const ACCESS_TOKEN = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ teamId: 'org_1', projectId: PROJECT_ID })).toString('base64url')}.signature`;
const REPLY = 'Your invoice is in Billing > Invoices.';

/**
 * A stand-in for Mastra Platform's `/v1/server/projects/:projectId` API. Agent runs, agent details,
 * and thread reads are served by Mastra's own route handlers, as the Managed Agents runtime does;
 * agent create/update/delete and the Platform's auth and end-user rules are reproduced around them.
 */
async function startPlatform() {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ logger: false, storage });
  const prompts: unknown[] = [];
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const prefix = `/v1/server/projects/${PROJECT_ID}`;
  const app = new Hono();

  app.use('/v1/server/projects/:projectId/*', async (c, next) => {
    if (c.req.header('authorization') !== `Bearer ${ACCESS_TOKEN}`) return c.json({ error: 'Unauthorized' }, 401);
    if (c.req.param('projectId') !== PROJECT_ID) return c.json({ error: 'Project not found' }, 404);
    return next();
  });
  // A project access token carries no user, so a run must name the end user it acts for.
  app.post(`${prefix}/agents/:agentId/:run{stream|generate}`, async (c, next) => {
    const body = (await c.req.raw.clone().json()) as { resourceId?: unknown };
    if (typeof body.resourceId !== 'string') return c.json({ error: 'resourceId is required' }, 400);
    return next();
  });
  app.post(`${prefix}/agents`, async c => {
    const body = await c.req.json();
    created.push(body);
    const id = `agent_${created.length}`;
    mastra.addAgent(
      new Agent({
        id,
        name: body.name,
        instructions: body.instructions,
        model: createMockModel({ mockText: REPLY, spyStream: props => prompts.push(props.prompt) }),
        memory: new Memory({ storage }),
      }),
      id,
    );
    return c.json({ id, name: body.name, instructions: body.instructions }, 201);
  });
  app.patch(`${prefix}/agents/:agentId`, async c => {
    const body = await c.req.json();
    updated.push(body);
    return c.json({ id: c.req.param('agentId'), name: body.name ?? 'Support' });
  });
  app.delete(`${prefix}/agents/:agentId`, c => {
    if (!mastra.removeAgent(c.req.param('agentId'))) return c.json({ error: 'agent_not_found' }, 404);
    return c.body(null, 204);
  });
  await new MastraServer({ app, mastra, prefix }).init();

  const server = await new Promise<ServerType>(resolve => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    apiUrl: `http://127.0.0.1:${port}`,
    prompts,
    created,
    updated,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

let platformApi: Awaited<ReturnType<typeof startPlatform>>;
const originalEnv = { ...process.env };

beforeAll(async () => {
  platformApi = await startPlatform();
});
afterAll(() => platformApi.close());
afterEach(() => {
  process.env = { ...originalEnv };
});

function platform() {
  return new MastraPlatform({ accessToken: ACCESS_TOKEN, apiUrl: platformApi.apiUrl });
}

async function streamedText(response: Awaited<ReturnType<ReturnType<MastraPlatform['getAgent']>['stream']>>) {
  let text = '';
  await response.processDataStream({
    onChunk: async chunk => {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    },
  });
  return text;
}

describe('MastraPlatform managed agents', () => {
  it('creates an agent that answers with its instructions, using only the project access token', async () => {
    const agent = await platform().createAgent({
      name: 'Support',
      instructions: 'You answer billing questions for Acme.',
      model: 'openai/gpt-5-mini',
    });

    const response = await agent.stream('Where is my invoice?', { memory: { thread: 'thread-1', resource: 'user-1' } });

    expect(await streamedText(response)).toBe(REPLY);
    // Platform agents only run Gateway models, sent as `{ provider: 'mastra', name }`.
    expect(platformApi.created.at(-1)).toMatchObject({ model: { provider: 'mastra', name: 'openai/gpt-5-mini' } });
    expect(JSON.stringify(platformApi.prompts.at(-1))).toContain('You answer billing questions for Acme.');
    expect(JSON.stringify(platformApi.prompts.at(-1))).toContain('Where is my invoice?');
  });

  it("saves the conversation to the end user's thread so it can be read back", async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });
    await streamedText(
      await agent.stream('Where is my invoice?', { memory: { thread: 'thread-2', resource: 'user-2' } }),
    );

    const { threads } = await agent.listThreads({ resourceId: 'user-2' });
    expect(threads.map(thread => thread.id)).toEqual(['thread-2']);
    const { messages } = await agent.listMessages('thread-2', { resourceId: 'user-2' });
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(JSON.stringify(messages)).toContain(REPLY);
  });

  it('generates a reply for an end user named without memory', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });

    const output = await agent.generate('Where is my invoice?', { resourceId: 'user-3' });

    expect(output.text).toBe(REPLY);
  });

  it('reports the Platform error when a run names no end user', async () => {
    const agent = await platform().createAgent({ name: 'Support', instructions: 'Answer billing questions.' });

    await expect(agent.generate('Where is my invoice?')).rejects.toThrow(/400.*resourceId is required/);
  });

  it('reads, lists, updates, and deletes agents', async () => {
    const client = platform();
    const agent = await client.createAgent({ name: 'Triage', instructions: 'Route incoming tickets.' });

    expect((await client.getAgent(agent.id).details()).instructions).toBe('Route incoming tickets.');
    expect(Object.keys(await client.listAgents())).toContain(agent.id);

    expect(await agent.update({ name: 'Ticket triage', model: 'anthropic/claude-sonnet-4-5' })).toMatchObject({
      id: agent.id,
      name: 'Ticket triage',
    });
    expect(platformApi.updated.at(-1)).toEqual({
      name: 'Ticket triage',
      model: { provider: 'mastra', name: 'anthropic/claude-sonnet-4-5' },
    });

    await agent.delete();
    expect(Object.keys(await client.listAgents())).not.toContain(agent.id);
    await expect(agent.delete()).rejects.toThrow(/404/);
  });
});

describe('MastraPlatform credentials', () => {
  it('reads the access token and API URL from the environment', async () => {
    delete process.env.MASTRA_PROJECT_ID;
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = ACCESS_TOKEN;
    process.env.MASTRA_PLATFORM_API_URL = platformApi.apiUrl;

    const client = new MastraPlatform();

    expect(client.projectId).toBe(PROJECT_ID);
    await expect(client.listAgents()).resolves.toBeTypeOf('object');
  });

  it('rejects a request made with a token the Platform does not accept', async () => {
    const client = new MastraPlatform({ accessToken: 'sk_wrong', projectId: PROJECT_ID, apiUrl: platformApi.apiUrl });

    await expect(client.listAgents()).rejects.toMatchObject({ status: 401 });
  });

  it('asks for a project only when a project method is used and the token does not name one', () => {
    delete process.env.MASTRA_PROJECT_ID;
    const client = new MastraPlatform({ accessToken: 'sk_org_key' });
    expect(client.projects).toBeDefined();
    expect(() => client.getAgent('agent-1')).toThrow('MastraPlatform: projectId is required');
    expect(client.project(PROJECT_ID).projectId).toBe(PROJECT_ID);
  });

  it('requires an access token', () => {
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    delete process.env.MASTRA_PLATFORM_SECRET_KEY;
    expect(() => new MastraPlatform()).toThrow('MastraPlatform: accessToken is required');
  });
});
