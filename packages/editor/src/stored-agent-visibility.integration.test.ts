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
const PRIVATE_WS = 'alice-private-ws';
const REPLY = 'hello from the mock model';

const thread = { resourceId: 'bob', threadId: 'bob-thread' };
// Signals target a run that doesn't exist, so the public-twin calls never start a run that would outlive the test.
const missingRun = { runId: 'some-run' };
const RUN_CONTROL_ROUTES: [string, (id: string) => string, unknown][] = [
  ['POST', id => `/agents/${id}/observe`, { runId: 'some-run' }],
  ['POST', id => `/agents/${id}/runs/some-run/abort`, {}],
  ['POST', id => `/agents/${id}/threads/abort`, thread],
  ['POST', id => `/agents/${id}/threads/signals/cancel`, { ...thread, signalIds: ['s1'] }],
  ['POST', id => `/agents/${id}/threads/subscribe`, thread],
  ['POST', id => `/agents/${id}/signals`, { ...missingRun, signal: { type: 'user-message', contents: 'hi' } }],
  ['POST', id => `/agents/${id}/send-message`, { ...missingRun, message: 'say hi' }],
  ['POST', id => `/agents/${id}/queue-message`, { ...missingRun, message: 'say hi' }],
  ['POST', id => `/agents/${id}/queue-signal`, { ...missingRun, signal: { type: 'user-message', contents: 'hi' } }],
  [
    'POST',
    id => `/agents/${id}/stream-until-idle`,
    { messages: 'say hi', memory: { thread: 'bob-thread', resource: 'bob' } },
  ],
  ['GET', id => `/agents/${id}/suspended-runs`, undefined],
  ['POST', id => `/agents/${id}/resume-stream`, { runId: 'some-run', resumeData: {} }],
  ['POST', id => `/agents/${id}/resume-stream-until-idle`, { runId: 'some-run', resumeData: {} }],
  ['POST', id => `/agents/${id}/recover`, { runId: 'some-run' }],
  ['POST', id => `/agents/${id}/approve-tool-call`, { runId: 'some-run', toolCallId: 't1' }],
  ['POST', id => `/agents/${id}/decline-tool-call`, { runId: 'some-run', toolCallId: 't1' }],
  ['POST', id => `/agents/${id}/clone`, {}],
  ['POST', id => `/agents/${id}/instructions/enhance`, { instructions: 'x', comment: 'y' }],
];

const USERS: Record<string, User> = {
  alice: { id: 'alice', role: 'builder' },
  bob: { id: 'bob', role: 'member' },
  admin: { id: 'admin', role: 'admin' },
  grantee: { id: 'grantee', role: 'grantee' },
  scheduler: { id: 'scheduler', role: 'scheduler' },
  carol: { id: 'carol', role: 'editor' },
};

const ROLES: RoleDefinition[] = [
  {
    id: 'builder',
    name: 'Builder',
    permissions: ['*:read', '*:execute', 'stored-agents:write', 'stored-agents:delete'],
  },
  { id: 'member', name: 'Member', permissions: ['*:read', '*:execute'] },
  { id: 'admin', name: 'Admin', permissions: ['*'] },
  { id: 'grantee', name: 'Grantee', permissions: ['*:read', '*:execute', `stored-agents:read:${PRIVATE}`] },
  { id: 'scheduler', name: 'Scheduler', permissions: ['*:read', '*:execute', 'schedules:write'] },
  // A second builder: can write, publish and delete stored agents, but only their own.
  {
    id: 'editor',
    name: 'Editor',
    permissions: ['*:read', '*:execute', 'stored-agents:write', 'stored-agents:publish', 'stored-agents:delete'],
  },
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
    const withWorkspace = await http('alice', 'POST', '/stored/agents', {
      id: PRIVATE_WS,
      name: PRIVATE_WS,
      instructions: 'Be brief.',
      model,
      visibility: 'private',
      workspace: {
        type: 'inline',
        config: {
          name: 'alice-secret-workspace',
          filesystem: { provider: 'local', config: { basePath: join(dir, 'ws') } },
        },
      },
    });
    expect(withWorkspace.status, withWorkspace.text).toBe(200);
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

    // The run-control routes (observe/abort/signals/messages/resume/recover/...) resolve the agent before looking up
    // the run or thread, so bob gets the access-denied 404 ("Not found") instead of the route's own result, and the
    // same request on the public twin gets past the check. The thread subscription never ends, so only its status is
    // read; every other response is drained so no run outlives the test.
    it.each(RUN_CONTROL_ROUTES)('bob gets the access-denied 404 on %s %s', async (method, path, body) => {
      const call = async (id: string) => {
        const response = await fetch(`${server.url}/api${path(id)}`, {
          method,
          headers: { authorization: 'Bearer bob', ...(body ? { 'content-type': 'application/json' } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (path(id).endsWith('/subscribe') && response.status !== 404) {
          await response.body?.cancel();
          return { status: response.status };
        }
        const text = await response.text();
        return { status: response.status, json: response.status === 404 ? JSON.parse(text) : undefined };
      };
      reply();

      expect(await call(PRIVATE)).toEqual({ status: 404, json: { error: 'Not found' } });
      expect(llm.getRequests()).toHaveLength(0);
      expect(await call(PUBLIC)).not.toEqual({ status: 404, json: { error: 'Not found' } });
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

  // Version routes serve the agent's full config and change which config is live, so they follow the same rules as
  // GET/PATCH/DELETE /stored/agents/:id.
  describe('/stored/agents/:id/versions', () => {
    let versionId: string;
    beforeAll(async () => {
      const versions = await http('alice', 'GET', `/stored/agents/${PRIVATE}/versions`);
      expect(versions.status).toBe(200);
      versionId = versions.json.versions[0].id;
    });

    it.each([
      ['GET versions', () => `/stored/agents/${PRIVATE}/versions`],
      ['GET versions/:id', () => `/stored/agents/${PRIVATE}/versions/${versionId}`],
      ['GET versions/compare', () => `/stored/agents/${PRIVATE}/versions/compare?from=${versionId}&to=${versionId}`],
    ])("bob gets 404 on %s for alice's private agent and sees none of its config", async (_name, path) => {
      const result = await http('bob', 'GET', path());
      expect(result.status).toBe(404);
      expect(result.text).not.toContain('Be brief.');
    });

    it("another builder can't create, activate, restore or delete versions of alice's private agent", async () => {
      const base = `/stored/agents/${PRIVATE}/versions`;
      expect((await http('carol', 'POST', base, { changeMessage: 'carol' })).status).toBe(404);
      expect((await http('carol', 'POST', `${base}/${versionId}/activate`)).status).toBe(404);
      expect((await http('carol', 'POST', `${base}/${versionId}/restore`)).status).toBe(404);
      expect((await http('carol', 'DELETE', `${base}/${versionId}`)).status).toBe(404);
      // Nothing changed: still exactly alice's one version.
      const versions = await http('alice', 'GET', base);
      expect(versions.json.versions.map((v: { id: string }) => v.id)).toEqual([versionId]);
    });

    it('public visibility lets others read versions but not change them', async () => {
      const base = `/stored/agents/${PUBLIC}/versions`;
      const versions = await http('carol', 'GET', base);
      expect(versions.status).toBe(200);
      expect((await http('carol', 'POST', base, { changeMessage: 'carol' })).status).toBe(404);
    });

    it('the owner and the write role still work on their own agents', async () => {
      const created = await http('alice', 'POST', `/stored/agents/${PRIVATE}/versions`, { changeMessage: 'alice' });
      expect(created.status).toBe(200);
      const own = await http('carol', 'POST', '/stored/agents', {
        id: 'carol-own',
        name: 'carol-own',
        instructions: 'Be brief.',
        model: { provider: 'openai', name: 'gpt-4o-mini' },
      });
      expect(own.status).toBe(200);
      const mine = await http('carol', 'GET', '/stored/agents/carol-own/versions');
      expect(mine.status).toBe(200);
      const ownVersion = mine.json.versions[0].id;
      expect((await http('carol', 'POST', `/stored/agents/carol-own/versions/${ownVersion}/activate`)).status).toBe(
        200,
      );
    });
  });

  // Handlers that search across every registered agent (here: the workspace list) must skip hidden stored agents too.
  it("bob's GET /workspaces does not surface the workspace of alice's private agent after she used it", async () => {
    reply();
    expect((await generate('alice', PRIVATE_WS)).status).toBe(200);
    const mine = await http('alice', 'GET', '/workspaces');
    expect(mine.text).toContain(PRIVATE_WS);
    const theirs = await http('bob', 'GET', '/workspaces');
    expect(theirs.status).toBe(200);
    expect(theirs.text).not.toContain(PRIVATE_WS);
    expect(theirs.text).not.toContain('alice-secret-workspace');

    // Editing the agent unregisters it from Mastra, but its workspace stays in the workspace registry.
    expect((await http('alice', 'PATCH', `/stored/agents/${PRIVATE_WS}`, { description: 'edited' })).status).toBe(200);
    const afterEdit = await http('bob', 'GET', '/workspaces');
    expect(afterEdit.status).toBe(200);
    expect(afterEdit.text).not.toContain(PRIVATE_WS);
    expect(afterEdit.text).not.toContain('alice-secret-workspace');
    expect((await http('alice', 'GET', '/workspaces')).text).toContain(PRIVATE_WS);

    // Deleting the agent leaves no stored record to check its registered workspace against.
    expect((await http('alice', 'DELETE', `/stored/agents/${PRIVATE_WS}`)).status).toBe(200);
    for (const user of ['bob', 'alice'] as const) {
      const afterDelete = await http(user, 'GET', '/workspaces');
      expect(afterDelete.status).toBe(200);
      expect(afterDelete.text).not.toContain(PRIVATE_WS);
      expect(afterDelete.text).not.toContain('alice-secret-workspace');
    }
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
