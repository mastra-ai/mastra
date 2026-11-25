import { Knowledge, KnowledgeImporter, createKnowledgeImporterHost } from '@mastra/core/knowledge';
import type { KnowledgeImporterContext } from '@mastra/core/knowledge';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { IMPORTER_RUN_PATH, createImporterSessionHost, handleImporterRun } from './importer-run';
import type { ImporterRunTarget } from './importer-run';

const API = 'http://knowledge.test';
const INSTANCE = 'kinst_1';

const runToken = (claims: Record<string, unknown>) =>
  ['h', Buffer.from(JSON.stringify({ knowledgeImporterRun: claims })).toString('base64url'), 'sig'].join('.');
const TOKEN = runToken({ instanceId: INSTANCE, bindingId: 'b1', runId: 'r', generation: 1 });

class TicketsImporter extends KnowledgeImporter({
  id: 'tickets',
  label: 'Tickets',
  credentials: { apiToken: { label: 'API token', description: 'Tickets API token' } },
}) {
  async import(ctx: KnowledgeImporterContext) {
    seen.push(ctx.credentials.apiToken);
    await ctx.items.upsert({ sourceId: 't1', title: 'Ticket 1', body: 'printer on fire' });
    await ctx.items.upsert({ sourceId: 't2', title: 'Ticket 2', body: 'password loop' });
  }
}
let seen: (string | undefined)[] = [];

/**
 * The Knowledge API's session routes, served by core's real host over an in-memory Knowledge. Like
 * Platform, it hands back credentials as env var names and accepts only the one run token.
 */
function knowledgeApi(options: { bindingCredentials?: Record<string, string>; failFirstFlush?: number } = {}) {
  const knowledge = new Knowledge({ storage: new InMemoryStore(), scopes: { 'docs:$orgId': {} } });
  const host = createKnowledgeImporterHost(knowledge, {
    bindings: [
      {
        id: 'b1',
        importer: 'tickets',
        target: 'docs:acme#tickets',
        settings: {},
        credentials: options.bindingCredentials ?? { apiToken: 'TICKETS_TOKEN' },
      },
    ],
  });
  const calls: string[] = [];
  let flushFailures = options.failFirstFlush ?? 0;
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    const op = path.slice(`${API}/v1/knowledge-importer-sessions/${INSTANCE}/`.length);
    calls.push(op);
    if ((init?.headers as Record<string, string>).authorization !== `Bearer ${TOKEN}`) {
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }
    const body = JSON.parse(String(init?.body));
    try {
      if (op === 'claim') return Response.json(await host.startRun('b1'));
      if (op === 'flush') {
        if (flushFailures-- > 0) return new Response('busy', { status: 503 });
        return Response.json(await host.flush(body));
      }
      if (op === 'heartbeat') return Response.json(await host.heartbeat(body.runId, body.generation));
      if (op === 'finish') return Response.json(await host.finishRun(body));
    } catch (error: any) {
      if (error?.status === 409) return Response.json({ error: { code: error.code } }, { status: 409 });
      throw error;
    }
    return new Response(null, { status: 404 });
  });
  return { knowledge, fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

async function pageBody(knowledge: Knowledge, path: string) {
  const storage = await knowledge.getStorage();
  const [scope] = await storage.getScopesByAddress(['docs:acme']);
  return (await storage.getPageByPath({ scopeId: scope!.id, path: path.split('/'), read: 'all' }))?.body;
}

const trigger = (token?: string, method = 'POST') =>
  new Request(`http://app.test${IMPORTER_RUN_PATH}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: method === 'POST' ? JSON.stringify({ bindingId: 'not-used', apiUrl: 'http://evil.test' }) : undefined,
  });

async function runToEnd(
  api: ReturnType<typeof knowledgeApi>,
  env: Record<string, string | undefined>,
  extra: Partial<ImporterRunTarget> = {},
) {
  let end!: (r: unknown) => void;
  const ended = new Promise(resolve => (end = resolve));
  const res = await handleImporterRun(trigger(TOKEN), {
    apiUrl: API,
    instanceId: INSTANCE,
    importers: [TicketsImporter],
    env,
    fetch: api.fetch,
    onEnd: end,
    ...extra,
  });
  return { res, result: (await ended) as any };
}

describe('handleImporterRun', () => {
  it('claims the run with the run token, runs the importer and writes its pages through the API', async () => {
    seen = [];
    const api = knowledgeApi();
    const { res, result } = await runToEnd(api, { TICKETS_TOKEN: 'secret-123' });

    expect(res.status).toBe(202);
    expect(result.outcome).toBe('succeeded');
    expect(seen).toEqual(['secret-123']);
    expect(await pageBody(api.knowledge, 'tickets/t1')).toContain('printer on fire');
    expect(await pageBody(api.knowledge, 'tickets/t2')).toContain('password loop');
    expect(api.calls[0]).toBe('claim');
    expect(api.calls.at(-1)).toBe('finish');
    // Every call went to the configured API, never to a URL from the trigger body.
    for (const [url] of (api.fetch as any).mock.calls) expect(String(url).startsWith(API)).toBe(true);
  });

  it('ends the run credential_missing when the env var Platform names is not set', async () => {
    seen = [];
    const api = knowledgeApi();
    const { result } = await runToEnd(api, {});

    expect(seen).toEqual([]);
    expect(result).toMatchObject({ outcome: 'failed', error: { code: 'credential_missing' } });
    expect(await pageBody(api.knowledge, 'tickets/t1')).toBeUndefined();
  });

  it.each(['MASTRA_KNOWLEDGE_ACCESS_TOKEN', 'MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_PLATFORM_SECRET_KEY'])(
    'never reads %s for an importer, even when Platform names it',
    async name => {
      seen = [];
      const denied: string[] = [];
      const api = knowledgeApi({ bindingCredentials: { apiToken: name } });
      const { result } = await runToEnd(
        api,
        { [name]: 'platform-secret' },
        { onDeniedCredential: n => denied.push(n) },
      );

      expect(seen).toEqual([]);
      expect(denied).toEqual([name]);
      expect(result).toMatchObject({ outcome: 'failed', error: { code: 'credential_missing' } });
    },
  );

  it('never reads a variable the app denies', async () => {
    seen = [];
    const api = knowledgeApi({ bindingCredentials: { apiToken: 'DATABASE_URL' } });
    const { result } = await runToEnd(
      api,
      { DATABASE_URL: 'postgres://secret' },
      { deniedCredentialEnv: ['DATABASE_URL'] },
    );

    expect(seen).toEqual([]);
    expect(result).toMatchObject({ outcome: 'failed', error: { code: 'credential_missing' } });
  });

  it('resends a flush the API answered with a 5xx', async () => {
    seen = [];
    const api = knowledgeApi({ failFirstFlush: 1 });
    const { result } = await runToEnd(api, { TICKETS_TOKEN: 'secret-123' });

    expect(result.outcome).toBe('succeeded');
    expect(api.calls.filter(op => op === 'flush').length).toBeGreaterThanOrEqual(2);
    expect(await pageBody(api.knowledge, 'tickets/t2')).toContain('password loop');
  });

  it('reports a failing importer as a failed receipt, after the run is ended on the API', async () => {
    class BrokenImporter extends KnowledgeImporter({ id: 'tickets', label: 'Tickets' }) {
      async import(): Promise<void> {
        throw new Error('source exploded');
      }
    }
    const api = knowledgeApi({ bindingCredentials: {} });
    const onError = vi.fn();
    const ended = new Promise<any>(resolve => {
      void handleImporterRun(trigger(TOKEN), {
        apiUrl: API,
        instanceId: INSTANCE,
        importers: [BrokenImporter],
        fetch: api.fetch,
        onEnd: resolve,
        onError,
      });
    });

    expect(await ended).toMatchObject({ outcome: 'failed', error: { code: 'importer_error' } });
    expect(onError).not.toHaveBeenCalled();
    expect(api.calls.at(-1)).toBe('finish');
  });

  it('reports a run that could not be claimed through onError', async () => {
    const fetch = vi.fn(async () => Response.json({ error: { code: 'already_claimed' } }, { status: 409 }));
    const failed = new Promise<any>(resolve => {
      void handleImporterRun(trigger(TOKEN), {
        apiUrl: API,
        instanceId: INSTANCE,
        importers: [TicketsImporter],
        fetch: fetch as any,
        onError: resolve,
      });
    });

    expect(await failed).toMatchObject({ name: 'KnowledgeImporterHostConflictError', code: 'already_claimed' });
  });

  it('refuses a trigger without a readable run token, for another instance, or not a POST', async () => {
    const api = knowledgeApi();
    const target = { apiUrl: API, instanceId: INSTANCE, importers: [TicketsImporter], fetch: api.fetch };

    expect((await handleImporterRun(trigger(), target)).status).toBe(401);
    expect((await handleImporterRun(trigger('not-a-jwt'), target)).status).toBe(401);
    const other = runToken({ instanceId: 'kinst_other', bindingId: 'b1' });
    expect((await handleImporterRun(trigger(other), target)).status).toBe(404);
    expect((await handleImporterRun(trigger(TOKEN, 'GET'), target)).status).toBe(405);
    expect(api.calls).toEqual([]);
  });
});

describe('createImporterSessionHost', () => {
  it("turns a 409 into core's conflict error with the API's code", async () => {
    const fetch = vi.fn(async () => Response.json({ error: { code: 'stale_generation' } }, { status: 409 }));
    const host = createImporterSessionHost({ apiUrl: API, instanceId: INSTANCE, token: TOKEN, fetch: fetch as any });

    await expect(host.heartbeat('r', 1)).rejects.toMatchObject({
      name: 'KnowledgeImporterHostConflictError',
      code: 'stale_generation',
      status: 409,
    });
  });

  it('refuses to follow a redirect, so the run token stays with the Knowledge API', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => {
      throw new TypeError('fetch failed: redirect mode is set to error');
    });
    const host = createImporterSessionHost({ apiUrl: API, instanceId: INSTANCE, token: TOKEN, fetch: fetch as any });

    await expect(host.heartbeat('r', 1)).rejects.toMatchObject({
      name: 'KnowledgeImporterHostError',
      status: undefined,
    });
    expect(fetch.mock.calls[0]![1].redirect).toBe('error');
  });
});

describe('PlatformKnowledge.handleImporterRun', () => {
  it('runs one of its importer classes against its own instance and API URL', async () => {
    const { PlatformKnowledge } = await import('./index');
    seen = [];
    const api = knowledgeApi();
    vi.stubGlobal('fetch', api.fetch);
    vi.stubEnv('TICKETS_TOKEN', 'secret-from-env');
    try {
      const knowledge = new PlatformKnowledge({
        accessToken: 'knowledge-token',
        instanceId: INSTANCE,
        apiUrl: API,
        importers: [TicketsImporter],
      });

      expect((await knowledge.handleImporterRun(trigger(TOKEN))).status).toBe(202);
      await vi.waitFor(() => expect(api.calls.at(-1)).toBe('finish'));
      expect(seen).toEqual(['secret-from-env']);
      expect(await pageBody(api.knowledge, 'tickets/t1')).toContain('printer on fire');

      const other = runToken({ instanceId: 'kinst_other', bindingId: 'b1' });
      expect((await knowledge.handleImporterRun(trigger(other))).status).toBe(404);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("passes the app's denied names through and warns with the name, never the value", async () => {
    const { PlatformKnowledge } = await import('./index');
    seen = [];
    const api = knowledgeApi({ bindingCredentials: { apiToken: 'DATABASE_URL' } });
    vi.stubGlobal('fetch', api.fetch);
    vi.stubEnv('DATABASE_URL', 'postgres://secret');
    try {
      const knowledge = new PlatformKnowledge({
        accessToken: 'knowledge-token',
        instanceId: INSTANCE,
        apiUrl: API,
        importers: [TicketsImporter],
        deniedCredentialEnv: ['DATABASE_URL'],
      });
      const warn = vi.spyOn(knowledge.logger, 'warn');

      expect((await knowledge.handleImporterRun(trigger(TOKEN))).status).toBe(202);
      await vi.waitFor(() => expect(api.calls.at(-1)).toBe('finish'));
      expect(seen).toEqual([]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
      expect(JSON.stringify(warn.mock.calls)).not.toContain('postgres://secret');
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
