import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
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

const AGENT = 'support-agent';
const OTHER_AGENT = 'other-agent';
const PRIVATE_AGENT = 'alice-private-agent';
const V1 = 'You are version ONE of the support agent.';
const V2 = 'You are version TWO of the support agent.';
const V3 = 'You are version THREE of the support agent.';
const MODEL = { provider: 'openai', name: 'gpt-4o-mini' };

const USERS: Record<string, User> = {
  alice: { id: 'alice', role: 'admin' },
  bob: { id: 'bob', role: 'member' },
};

const ROLES: RoleDefinition[] = [
  { id: 'admin', name: 'Admin', permissions: ['*'] },
  { id: 'member', name: 'Member', permissions: ['*:read', '*:execute'] },
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
 * Version tags let a team name a version of a stored agent ("production", "staging") and call that
 * name from the API while the editor keeps publishing and drafting newer versions. Tags live in the
 * agent's `metadata.versionTags`; these tests drive them the way a user does: real MastraEditor +
 * LibSQL + auth/RBAC + Hono over a socket, with the model mocked at the wire so "which version
 * answered" is asserted on what the model actually received.
 */
describe('agent version tags', () => {
  let dir: string;
  let storage: LibSQLStore;
  let llm: LLMock;
  let server: { url: string; close: () => Promise<void> };
  const versionIds: Record<'v1' | 'v2' | 'v3', string> = { v1: '', v2: '', v3: '' };
  const previousBaseUrl = process.env.OPENAI_BASE_URL;
  const previousKey = process.env.OPENAI_API_KEY;

  async function http(token: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${server.url}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
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

  const setTags = (agentId: string, versionTags: Record<string, string>, token = 'alice') =>
    http(token, 'PATCH', `/stored/agents/${agentId}`, { metadata: { versionTags } });

  const listVersions = async (agentId: string) => {
    const result = await http('alice', 'GET', `/stored/agents/${agentId}/versions?perPage=100&orderBy[direction]=ASC`);
    expect(result.status, result.text).toBe(200);
    return result.json.versions as { id: string; versionNumber: number }[];
  };

  /** Calls the agent and returns what the model was sent, so the test can see which version ran. */
  async function generateAndCaptureModelInput(requestContext?: Record<string, unknown>, token = 'alice') {
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const result = await http(token, 'POST', `/agents/${AGENT}/generate`, {
      messages: 'hi',
      ...(requestContext ? { requestContext } : {}),
    });
    return { result, modelInput: JSON.stringify(llm.getRequests().map(request => request.body)) };
  }

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    process.env.OPENAI_BASE_URL = `${llm.url.replace(/\/+$/, '')}/v1`;
    process.env.OPENAI_API_KEY = 'aimock-test-key';

    dir = await mkdtemp(join(tmpdir(), 'agent-version-tags-'));
    storage = new LibSQLStore({ id: 'agent-version-tags', url: `file:${join(dir, 'mastra.db')}` });
    const mastra = new Mastra({
      logger: false,
      storage,
      editor: new MastraEditor(),
      server: {
        auth: new SimpleAuth<User>({ tokens: USERS, mapUserToResourceId: user => user.id }),
        rbac: new StaticRBACProvider<User>({ roles: ROLES, getUserRoles: user => [user.role] }),
      },
    });
    server = await startServer(mastra);

    // v1 is published on create; v2 and v3 are saved after it. v2 is then published, so:
    // published = v2, draft (latest) = v3, and v1 is an older version nothing points at yet.
    const created = await http('alice', 'POST', '/stored/agents', {
      id: AGENT,
      name: AGENT,
      instructions: V1,
      model: MODEL,
      visibility: 'public',
    });
    expect(created.status, created.text).toBe(200);
    for (const instructions of [V2, V3]) {
      const saved = await http('alice', 'PATCH', `/stored/agents/${AGENT}`, { instructions });
      expect(saved.status, saved.text).toBe(200);
    }
    const versions = await listVersions(AGENT);
    expect(versions.map(version => version.versionNumber)).toEqual([1, 2, 3]);
    [versionIds.v1, versionIds.v2, versionIds.v3] = versions.map(version => version.id);
    const published = await http('alice', 'POST', `/stored/agents/${AGENT}/versions/${versionIds.v2}/activate`);
    expect(published.status, published.text).toBe(200);

    for (const [id, visibility] of [
      [OTHER_AGENT, 'public'],
      [PRIVATE_AGENT, 'private'],
    ] as const) {
      const other = await http('alice', 'POST', '/stored/agents', {
        id,
        name: id,
        instructions: 'Be brief.',
        model: MODEL,
        visibility,
      });
      expect(other.status, other.text).toBe(200);
    }
  });

  afterEach(async () => {
    llm.clearFixtures();
    llm.clearRequests();
    // Each test starts from an untagged agent.
    await setTags(AGENT, {});
  });

  afterAll(async () => {
    await server?.close();
    await llm?.stop();
    await rm(dir, { recursive: true, force: true });
    if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previousBaseUrl;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  describe('calling an agent by tag', () => {
    it('runs the tagged version instead of the published one', async () => {
      expect((await setTags(AGENT, { production: versionIds.v1 })).status).toBe(200);

      const tagged = await generateAndCaptureModelInput({ agentVersionTag: 'production' });
      expect(tagged.result.status, tagged.result.text).toBe(200);
      expect(tagged.modelInput).toContain(V1);
      expect(tagged.modelInput).not.toContain(V2);
    });

    it('leaves untagged calls on the published version', async () => {
      await setTags(AGENT, { production: versionIds.v1 });

      const untagged = await generateAndCaptureModelInput();
      expect(untagged.result.status, untagged.result.text).toBe(200);
      expect(untagged.modelInput).toContain(V2);
    });

    it('follows the tag when it is moved to another version', async () => {
      await setTags(AGENT, { production: versionIds.v1 });
      await setTags(AGENT, { production: versionIds.v3 });

      const { modelInput } = await generateAndCaptureModelInput({ agentVersionTag: 'production' });
      expect(modelInput).toContain(V3);
      expect(modelInput).not.toContain(V1);
    });

    it('describes the tagged version on GET /agents/:id?tag=', async () => {
      await setTags(AGENT, { production: versionIds.v1 });

      const tagged = await http('bob', 'GET', `/agents/${AGENT}?tag=production`);
      expect(tagged.status, tagged.text).toBe(200);
      expect(tagged.text).toContain(V1);

      const published = await http('bob', 'GET', `/agents/${AGENT}`);
      expect(published.text).toContain(V2);
    });

    it('treats the reserved "draft" and "published" names like the matching status', async () => {
      const draft = await http('alice', 'GET', `/agents/${AGENT}?tag=draft`);
      expect(draft.status, draft.text).toBe(200);
      expect(draft.text).toContain(V3);

      const published = await http('alice', 'GET', `/agents/${AGENT}?tag=published`);
      expect(published.text).toContain(V2);
    });

    it('prefers an explicit version ID over a tag', async () => {
      await setTags(AGENT, { production: versionIds.v3 });

      const described = await http('alice', 'GET', `/agents/${AGENT}?tag=production&versionId=${versionIds.v1}`);
      expect(described.status, described.text).toBe(200);
      expect(described.text).toContain(V1);
    });

    // Not a tag bug: on a stored agent, calling with an explicit `agentVersionId` (no tag involved)
    // runs the latest draft instead of the requested version. The request's default status becomes
    // "draft" for a version ID, and the agent re-resolves itself from that default when it executes.
    // Tagged calls avoid this by pinning the resolved version for the run. Kept visible here because
    // it is the neighbouring selector; remove `.fails` once explicit version IDs are pinned too.
    it.fails('runs the requested version when called with an explicit version ID', async () => {
      const { modelInput } = await generateAndCaptureModelInput({ agentVersionId: versionIds.v1 });
      expect(modelInput).toContain(V1);
    });

    it('returns 404 for a tag the agent does not have, without calling the model', async () => {
      const { result } = await generateAndCaptureModelInput({ agentVersionTag: 'no-such-tag' });
      expect(result.status).toBe(404);
      expect(result.json.error).toContain('Version tag "no-such-tag" not found');
      expect(llm.getRequests()).toHaveLength(0);
    });

    it("does not reveal a private agent's tags to someone who cannot see the agent", async () => {
      const [version] = await listVersions(PRIVATE_AGENT);
      expect((await setTags(PRIVATE_AGENT, { production: version!.id })).status).toBe(200);

      // Bob gets the same answer for a real tag, a made-up tag and no tag at all.
      const responses = await Promise.all(
        ['?tag=production', '?tag=made-up', ''].map(query => http('bob', 'GET', `/agents/${PRIVATE_AGENT}${query}`)),
      );
      expect(responses.map(response => response.status)).toEqual([404, 404, 404]);
      expect(new Set(responses.map(response => response.text)).size).toBe(1);
    });
  });

  describe('setting tags', () => {
    it('keeps tags when other metadata is edited', async () => {
      await setTags(AGENT, { production: versionIds.v1, staging: versionIds.v3 });
      const edited = await http('alice', 'PATCH', `/stored/agents/${AGENT}`, { metadata: { team: 'support' } });
      expect(edited.status, edited.text).toBe(200);

      const agent = await http('alice', 'GET', `/stored/agents/${AGENT}`);
      expect(agent.json.metadata).toMatchObject({
        team: 'support',
        versionTags: { production: versionIds.v1, staging: versionIds.v3 },
      });
    });

    it('does not create a new version', async () => {
      await setTags(AGENT, { production: versionIds.v1 });
      expect(await listVersions(AGENT)).toHaveLength(3);
    });

    it.each([
      ['a reserved name', { published: 'v2' }, 'reserved'],
      ['the other reserved name', { draft: 'v2' }, 'reserved'],
      ['a name with spaces', { 'my tag': 'v2' }, 'Version tag names must be'],
    ])('rejects %s', async (_name, tags, message) => {
      const versionTags = Object.fromEntries(Object.keys(tags).map(name => [name, versionIds.v2]));
      const result = await setTags(AGENT, versionTags);
      expect(result.status).toBe(400);
      expect(result.text).toContain(message);
    });

    it('rejects a tag pointing at a version that does not exist', async () => {
      const result = await setTags(AGENT, { production: 'missing-version-id' });
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('Cannot set version tag "production"');
    });

    it("rejects a tag pointing at another agent's version", async () => {
      const [otherVersion] = await listVersions(OTHER_AGENT);
      const result = await setTags(AGENT, { production: otherVersion!.id });
      expect(result.status).toBe(400);

      const agent = await http('alice', 'GET', `/stored/agents/${AGENT}`);
      expect(agent.json.metadata?.versionTags ?? {}).toEqual({});
    });

    it('rejects tags on create, because a new agent has no versions to point at', async () => {
      const result = await http('alice', 'POST', '/stored/agents', {
        id: 'tagged-on-create',
        name: 'tagged-on-create',
        instructions: 'Be brief.',
        model: MODEL,
        metadata: { versionTags: { production: versionIds.v1 } },
      });
      expect(result.status).toBe(400);
      expect((await http('alice', 'GET', '/stored/agents/tagged-on-create')).status).toBe(404);
    });

    it('is limited to people who can edit the agent', async () => {
      const result = await setTags(AGENT, { production: versionIds.v1 }, 'bob');
      expect(result.status).toBeGreaterThanOrEqual(400);

      const agent = await http('alice', 'GET', `/stored/agents/${AGENT}`);
      expect(agent.json.metadata?.versionTags ?? {}).toEqual({});
    });
  });

  describe('a tagged version stays available', () => {
    it('cannot be deleted until the tag is removed or moved', async () => {
      await setTags(AGENT, { production: versionIds.v1 });

      const blocked = await http('alice', 'DELETE', `/stored/agents/${AGENT}/versions/${versionIds.v1}`);
      expect(blocked.status).toBe(400);
      expect(blocked.json.error).toContain('"production"');
      expect((await listVersions(AGENT)).map(version => version.id)).toContain(versionIds.v1);
    });

    // Version history is capped (50 per agent) by pruning the oldest versions on save. A long-lived
    // "production" tag is exactly the kind of old version that would otherwise be pruned.
    it('survives version-history pruning, while untagged old versions are removed', async () => {
      const agentId = 'busy-agent';
      const created = await http('alice', 'POST', '/stored/agents', {
        id: agentId,
        name: agentId,
        instructions: 'revision 1',
        model: MODEL,
      });
      expect(created.status, created.text).toBe(200);
      await http('alice', 'PATCH', `/stored/agents/${agentId}`, { instructions: 'revision 2' });
      await http('alice', 'PATCH', `/stored/agents/${agentId}`, { instructions: 'revision 3' });
      const [, second, third] = await listVersions(agentId);
      // v1 is published (active); tag v2 and leave v3 unprotected.
      expect((await setTags(agentId, { production: second!.id })).status).toBe(200);

      for (let revision = 4; revision <= 56; revision++) {
        const saved = await http('alice', 'PATCH', `/stored/agents/${agentId}`, {
          instructions: `revision ${revision}`,
        });
        expect(saved.status, saved.text).toBe(200);
      }

      const remaining = (await listVersions(agentId)).map(version => version.id);
      expect(remaining).toContain(second!.id);
      expect(remaining).not.toContain(third!.id);

      const tagged = await http('alice', 'GET', `/agents/${agentId}?tag=production`);
      expect(tagged.status, tagged.text).toBe(200);
      expect(tagged.text).toContain('revision 2');
    }, 60_000);
  });
});
