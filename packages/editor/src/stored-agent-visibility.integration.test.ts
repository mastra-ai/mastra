import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import type { RoleDefinition } from '@mastra/core/auth/ee';
import { StaticRBACProvider } from '@mastra/core/auth/ee';
import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MastraEditor } from './index';

type User = { id: string; role: string };

const PRIVATE = 'alice-private';
const PUBLIC = 'alice-public';
const LEGACY = 'legacy-unowned';
const REPLY = 'hello from the mock model';

const USERS: Record<string, User> = {
  alice: { id: 'alice', role: 'builder' },
  bob: { id: 'bob', role: 'member' },
  admin: { id: 'admin', role: 'admin' },
  grantee: { id: 'grantee', role: 'grantee' },
  scheduler: { id: 'scheduler', role: 'scheduler' },
};

const ROLES: RoleDefinition[] = [
  { id: 'builder', name: 'Builder', permissions: ['*:read', '*:execute', 'stored-agents:write'] },
  { id: 'member', name: 'Member', permissions: ['*:read', '*:execute'] },
  { id: 'admin', name: 'Admin', permissions: ['*'] },
  { id: 'grantee', name: 'Grantee', permissions: ['*:read', '*:execute', `stored-agents:read:${PRIVATE}`] },
  { id: 'scheduler', name: 'Scheduler', permissions: ['*:read', '*:execute', 'schedules:write'] },
];

async function startServer(mastra: Mastra) {
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  const server = serve({ fetch: app.fetch, port: 0 });
  await new Promise(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  return {
    url: `http://localhost:${address.port}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

/**
 * Private stored agents must stay private on `/api/agents/*` (and the other routes that resolve agents by id), the same
 * way they already are on `/api/stored/agents/*`. Real MastraEditor + LibSQL + SimpleAuth/RBAC + Hono over a socket;
 * the model is aimock at the wire level, so "B's call never reached the model" is asserted on the boundary.
 */
describe('stored agent visibility on /api/agents', () => {
  let dir: string;
  let storage: LibSQLStore;
  let llm: LLMock;
  let server: { url: string; close: () => Promise<void> };
  const previousBaseUrl = process.env.OPENAI_BASE_URL;
  const previousKey = process.env.OPENAI_API_KEY;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    process.env.OPENAI_BASE_URL = `${llm.url.replace(/\/+$/, '')}/v1`;
    process.env.OPENAI_API_KEY = 'aimock-test-key';

    dir = await mkdtemp(join(tmpdir(), 'stored-agent-visibility-'));
    storage = new LibSQLStore({ id: 'stored-agent-visibility', url: `file:${join(dir, 'mastra.db')}` });
    const mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        helper: new Agent({ id: 'helper', name: 'helper', instructions: 'test', model: 'openai/gpt-4o-mini' }),
      },
      editor: new MastraEditor(),
      server: {
        auth: new SimpleAuth<User>({ tokens: USERS, mapUserToResourceId: user => user.id }),
        rbac: new StaticRBACProvider<User>({ roles: ROLES, getUserRoles: user => [user.role] }),
      },
    });
    server = await startServer(mastra);

    const model = { provider: 'openai', name: 'gpt-4o-mini' };
    for (const [id, visibility] of [
      [PRIVATE, 'private'],
      [PUBLIC, 'public'],
    ] as const) {
      const created = await http('alice', 'POST', '/stored/agents', {
        id,
        name: id,
        instructions: 'Be brief.',
        model,
        visibility,
      });
      expect(created.status).toBe(200);
    }
    // Rows created before ownership existed have no author and stay visible to everyone.
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({ agent: { id: LEGACY, name: LEGACY, instructions: 'Be brief.', model } as any });
  });

  afterEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
  });

  afterAll(async () => {
    await server?.close();
    await llm?.stop();
    await rm(dir, { recursive: true, force: true });
    process.env.OPENAI_BASE_URL = previousBaseUrl;
    process.env.OPENAI_API_KEY = previousKey;
  });

  async function http(token: string | null, method: string, path: string, body?: unknown, base = server.url) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, text, json };
  }

  const reply = () => llm.on({ endpoint: 'chat' }, { content: REPLY });
  const generate = (token: string | null, id: string, base?: string) =>
    http(token, 'POST', `/agents/${id}/generate`, { messages: 'say hi' }, base);
  const stream = (token: string | null, id: string) =>
    http(token, 'POST', `/agents/${id}/stream`, { messages: 'say hi' });

  describe("another user (bob) cannot see or use alice's private stored agent", () => {
    it('is not listed in GET /agents, while public, legacy and code agents still are', async () => {
      const list = await http('bob', 'GET', '/agents');
      expect(list.status).toBe(200);
      expect(Object.keys(list.json)).not.toContain(PRIVATE);
      expect(Object.keys(list.json)).toEqual(expect.arrayContaining(['helper', PUBLIC, LEGACY]));
    });

    it.each([
      ['GET /agents/:id', () => http('bob', 'GET', `/agents/${PRIVATE}`)],
      ['POST /agents/:id/generate', () => generate('bob', PRIVATE)],
      ['POST /agents/:id/stream', () => stream('bob', PRIVATE)],
      ['GET /agents/:id/voice/speakers', () => http('bob', 'GET', `/agents/${PRIVATE}/voice/speakers`)],
      ['POST /v1/responses', () => http('bob', 'POST', '/v1/responses', { agent_id: PRIVATE, input: 'say hi' })],
      ['GET /.well-known/:id/agent-card.json', () => http('bob', 'GET', `/.well-known/${PRIVATE}/agent-card.json`)],
      ['GET /memory/status?agentId=', () => http('bob', 'GET', `/memory/status?agentId=${PRIVATE}`)],
      ['GET /memory/config?agentId=', () => http('bob', 'GET', `/memory/config?agentId=${PRIVATE}`)],
    ])('%s returns 404 and never reaches the model', async (_name, call) => {
      reply();
      const result = await call();
      expect(result.status).toBe(404);
      expect(llm.getRequests()).toHaveLength(0);
    });

    it.each([PUBLIC, LEGACY])('can still read and call %s', async id => {
      reply();
      expect((await http('bob', 'GET', `/agents/${id}`)).status).toBe(200);
      const result = await generate('bob', id);
      expect(result.status).toBe(200);
      expect(result.json.text).toBe(REPLY);
    });
  });

  describe.each(['alice', 'admin', 'grantee'])('%s (owner / admin bypass / scoped read grant)', user => {
    it('sees the private agent in GET /agents/:id, and in GET /agents exactly when GET /stored/agents lists it', async () => {
      expect((await http(user, 'GET', `/agents/${PRIVATE}`)).status).toBe(200);

      // A grant scoped to one agent id opens that agent by id; like /stored/agents, it doesn't add it to listings.
      const listed = user !== 'grantee';
      const stored = await http(user, 'GET', '/stored/agents');
      expect(stored.json.agents.map((agent: { id: string }) => agent.id).includes(PRIVATE)).toBe(listed);
      const list = await http(user, 'GET', '/agents');
      expect(Object.keys(list.json).includes(PRIVATE)).toBe(listed);
    });

    it('can generate and stream with the private agent', async () => {
      reply();
      const generated = await generate(user, PRIVATE);
      expect(generated.status).toBe(200);
      expect(generated.json.text).toBe(REPLY);

      const streamed = await stream(user, PRIVATE);
      expect(streamed.status).toBe(200);
      expect(streamed.text).toContain('hello');
      expect(llm.getRequests().length).toBeGreaterThanOrEqual(2);
    });
  });

  // Once someone has used it, the editor registers the hydrated agent on Mastra, so it's reachable through
  // `mastra.getAgentById`/`listAgents` too. The check must hold there as well.
  describe('after the private agent has been hydrated by its owner', () => {
    beforeAll(async () => {
      llm.on({ endpoint: 'chat' }, { content: REPLY });
      expect((await generate('alice', PRIVATE)).status).toBe(200);
      llm.clearFixtures();
      llm.clearRequests();
    });

    it('bob still does not see it in GET /agents', async () => {
      const list = await http('bob', 'GET', '/agents');
      expect(Object.keys(list.json)).not.toContain(PRIVATE);
      expect(Object.keys(list.json)).toEqual(expect.arrayContaining(['helper', PUBLIC, LEGACY]));
    });

    it.each([
      ['GET /agents/:id', () => http('bob', 'GET', `/agents/${PRIVATE}`)],
      ['POST /agents/:id/generate', () => generate('bob', PRIVATE)],
      ['POST /agents/:id/stream', () => stream('bob', PRIVATE)],
      ['GET /agents/:id/voice/listener', () => http('bob', 'GET', `/agents/${PRIVATE}/voice/listener`)],
      ['GET /memory/status?agentId=', () => http('bob', 'GET', `/memory/status?agentId=${PRIVATE}`)],
      ['GET /memory/config?agentId=', () => http('bob', 'GET', `/memory/config?agentId=${PRIVATE}`)],
    ])('bob gets 404 on %s and never reaches the model', async (_name, call) => {
      reply();
      expect((await call()).status).toBe(404);
      expect(llm.getRequests()).toHaveLength(0);
    });

    // A missing skill and a hidden agent are both 404; the body tells them apart ("Not found" = access denied, as on
    // /stored/agents). Before the fix the agent resolved and bob got the skill lookup's own 404.
    it('bob gets the access-denied 404 on GET /agents/:id/skills/:skillName', async () => {
      const denied = await http('bob', 'GET', `/agents/${PRIVATE}/skills/missing`);
      expect(denied.status).toBe(404);
      expect(denied.json).toEqual({ error: 'Not found' });
      const owner = await http('alice', 'GET', `/agents/${PRIVATE}/skills/missing`);
      expect(owner.json).not.toEqual({ error: 'Not found' });
    });

    it('a user who can create schedules cannot schedule it', async () => {
      const body = (agentId: string) => ({ agentId, cron: '0 0 1 1 *', prompt: 'say hi' });
      expect((await http('scheduler', 'POST', '/schedules', body(PRIVATE))).status).toBe(404);
      expect((await http('scheduler', 'POST', '/schedules', body(PUBLIC))).status).toBe(200);
    });

    it('alice still lists and calls it', async () => {
      reply();
      expect(Object.keys((await http('alice', 'GET', '/agents')).json)).toContain(PRIVATE);
      const result = await generate('alice', PRIVATE);
      expect(result.status).toBe(200);
      expect(result.json.text).toBe(REPLY);
    });
  });

  it('without auth configured, every stored agent stays listable and callable', async () => {
    const open = await startServer(new Mastra({ logger: false, storage, editor: new MastraEditor() }));
    try {
      reply();
      const list = await http(null, 'GET', '/agents', undefined, open.url);
      expect(Object.keys(list.json)).toEqual(expect.arrayContaining([PRIVATE, PUBLIC, LEGACY]));
      const result = await generate(null, PRIVATE, open.url);
      expect(result.status).toBe(200);
      expect(result.json.text).toBe(REPLY);
    } finally {
      await open.close();
    }
  });
});
