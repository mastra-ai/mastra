import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MastraProject } from './mastra-platform';
import { MastraPlatformError } from './provisioning/index';

const TOKEN = 'org-key';
const PROJECT_ID = 'proj_1';
const OTHER_PROJECT_ID = 'proj_2';

type Key = {
  keyId: string;
  projectId: string;
  label: string;
  keyPrefix: string;
  region: string;
  revoked: boolean;
  policyRevision: string;
  allowedModels: string[] | null;
  zeroDataRetention: boolean;
  spendLimit?: { limitUsd: string; reset?: unknown; startedAt: string };
  secret: string;
  revision: number;
};

/**
 * A stand-in for the Platform's Gateway v2 routes. Like the real API it returns a key's secret only
 * when it is created, refuses an update whose `expectedRevision` is stale with 409, keeps revoked
 * keys listed, and counts usage per project, key and model from the requests `call()` records.
 */
function gatewayApi() {
  const keys = new Map<string, Key>();
  const calls: { projectId: string; keyId: string; model: string; at: number }[] = [];
  const usageQueries: URLSearchParams[] = [];
  let nextId = 1;

  const wire = ({ projectId: _p, secret: _s, revision: _r, ...key }: Key) => key;

  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'Unauthorized' });
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';

    if (url.pathname === '/v1/gateway/organization/v2/models') {
      const region = url.searchParams.get('region') ?? 'us';
      const models = [
        { id: 'openai/gpt-5-mini', regions: ['us'] },
        { id: 'mistral/mistral-large', regions: ['us', 'eu'] },
      ];
      return send(200, { models: models.filter(m => m.regions.includes(region)) });
    }

    if (url.pathname === '/v1/gateway/organization/v2/usage') {
      usageQueries.push(url.searchParams);
      const q = url.searchParams;
      const from = Date.parse(q.get('from')!);
      const to = Date.parse(q.get('to')!);
      if (!(from < to)) return send(400, { detail: 'Usage interval must be positive and at most 90 days' });
      const matching = calls.filter(
        c =>
          c.at >= from &&
          c.at < to &&
          (!q.get('projectId') || c.projectId === q.get('projectId')) &&
          (!q.get('apiKeyId') || c.keyId === q.get('apiKeyId')) &&
          (!q.get('model') || c.model === q.get('model')),
      );
      const groupBy = q.get('groupBy') ?? 'total';
      const view = q.get('view') ?? 'requests';
      const groups = new Map<string | null, number>();
      for (const c of matching) {
        const dimension = groupBy === 'model' ? c.model : groupBy === 'api_key' ? c.keyId : null;
        groups.set(dimension, (groups.get(dimension) ?? 0) + 1);
      }
      const rows = [...groups].map(([dimension, n]) =>
        view === 'attempts'
          ? { dimension, attempts: n, servedAttempts: n, totalTokens: { sum: n * 10, reportedAttempts: n } }
          : { dimension, requests: n, errors: 0, delivered: n, averageLatencyMs: 100 },
      );
      return send(200, { view, groupBy, rows });
    }

    const m = url.pathname.match(/^\/v1\/gateway\/projects\/([^/]+)\/v2\/keys(?:\/([^/]+))?(\/budget)?$/);
    if (!m) return send(404, { error: 'Not found' });
    const [, projectId, keyId, budget] = m;

    if (!keyId) {
      if (method === 'GET') {
        return send(200, { keys: [...keys.values()].filter(k => k.projectId === projectId).map(wire) });
      }
      if (!body?.label) return send(400, { detail: 'label is required' });
      const id = `key_${nextId++}`;
      const secret = `msk-gateway-secret-${id}`;
      keys.set(id, {
        keyId: id,
        projectId: projectId!,
        label: body.label,
        keyPrefix: secret.slice(0, 20),
        region: body.region ?? 'us',
        revoked: false,
        policyRevision: `${id}:1`,
        allowedModels: body.allowedModels ?? null,
        zeroDataRetention: body.zeroDataRetention ?? false,
        ...(body.spendLimit && { spendLimit: { ...body.spendLimit, startedAt: '2026-11-27T00:00:00.000Z' } }),
        secret,
        revision: 1,
      });
      return send(201, { keyId: id, apiKey: secret });
    }

    const key = keys.get(keyId);
    if (!key || key.projectId !== projectId || key.revoked) return send(404, { error: 'Key not found' });
    if (budget) {
      if (!key.spendLimit) return send(404, { error: 'Key has no spend limit' });
      const spent = calls.filter(c => c.keyId === key.keyId).length * 0.25;
      return send(200, {
        budget: {
          policy: key.spendLimit,
          window: { startsAt: key.spendLimit.startedAt, endsAt: null },
          spentUsd: String(spent),
          heldUsd: '0',
          remainingUsd: String(Number(key.spendLimit.limitUsd) - spent),
        },
      });
    }
    if (method === 'PATCH') {
      if (body.expectedRevision !== key.policyRevision) {
        return send(409, { error: 'Gateway v2 revision changed; refresh and retry' });
      }
      if (body.label !== undefined) key.label = body.label;
      if (body.spendLimit === null) delete key.spendLimit;
      else if (body.spendLimit) key.spendLimit = { ...body.spendLimit, startedAt: '2026-11-27T00:00:00.000Z' };
      key.policyRevision = `${key.keyId}:${++key.revision}`;
      return send(200, { key: wire(key) });
    }
    if (method === 'DELETE') {
      key.revoked = true;
      return send(200, { ok: true });
    }
    return send(405, { error: 'Method not allowed' });
  });

  return {
    server,
    usageQueries,
    /** Records a Gateway request made with a key, as the Gateway would. */
    call(apiKey: string, model: string, at = Date.now()) {
      const key = [...keys.values()].find(k => k.secret === apiKey && !k.revoked);
      if (!key) throw new Error('Gateway refused the key');
      if (key.allowedModels && !key.allowedModels.includes(model)) throw new Error(`Key may not call ${model}`);
      calls.push({ projectId: key.projectId, keyId: key.keyId, model, at });
    },
    get apiUrl() {
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    },
  };
}

const api = gatewayApi();
beforeAll(() => new Promise<void>(resolve => api.server.listen(0, '127.0.0.1', resolve)));
afterAll(() => new Promise(resolve => api.server.close(resolve)));

const project = (projectId = PROJECT_ID, accessToken = TOKEN) =>
  new MastraProject({ accessToken, projectId, apiUrl: api.apiUrl });

describe('MastraProject gateway', () => {
  it('creates a key that calls the Gateway, and revokes it', async () => {
    const { gateway } = project();
    const created = await gateway.createKey({ label: 'backend', allowedModels: ['openai/gpt-5-mini'] });
    api.call(created.apiKey, 'openai/gpt-5-mini');
    expect(() => api.call(created.apiKey, 'mistral/mistral-large')).toThrow('may not call');

    const [listed] = (await gateway.listKeys()).filter(k => k.keyId === created.keyId);
    expect(listed).toMatchObject({ label: 'backend', allowedModels: ['openai/gpt-5-mini'], revoked: false });
    expect(JSON.stringify(listed)).not.toContain(created.apiKey);

    await gateway.revokeKey(created.keyId);
    expect(() => api.call(created.apiKey, 'openai/gpt-5-mini')).toThrow('refused');
    expect((await gateway.listKeys()).find(k => k.keyId === created.keyId)).toMatchObject({ revoked: true });
  });

  it('reports what a key with a spend limit has spent, and changes or removes the limit', async () => {
    const { gateway } = project();
    const { keyId, apiKey } = await gateway.createKey({
      label: 'capped',
      spendLimit: { limitUsd: '5', reset: { every: 1, unit: 'month' } },
    });
    api.call(apiKey, 'openai/gpt-5-mini');
    api.call(apiKey, 'openai/gpt-5-mini');
    expect(await gateway.keyBudget(keyId)).toMatchObject({ spentUsd: '0.5', remainingUsd: '4.5' });

    const raised = await gateway.updateKey(keyId, { label: 'capped-more', spendLimit: { limitUsd: '20' } });
    expect(raised).toMatchObject({ label: 'capped-more', spendLimit: { limitUsd: '20' } });
    expect(await gateway.keyBudget(keyId)).toMatchObject({ remainingUsd: '19.5' });

    const uncapped = await gateway.updateKey(keyId, { spendLimit: null });
    expect(uncapped.spendLimit).toBeUndefined();
    await expect(gateway.keyBudget(keyId)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an update based on a revision that has since changed', async () => {
    const { gateway } = project();
    const { keyId } = await gateway.createKey({ label: 'shared' });
    const [before] = (await gateway.listKeys()).filter(k => k.keyId === keyId);

    await gateway.updateKey(keyId, { label: 'renamed by someone else' });
    await expect(
      gateway.updateKey(keyId, { label: 'mine', expectedRevision: before!.policyRevision }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await gateway.listKeys()).find(k => k.keyId === keyId)?.label).toBe('renamed by someone else');

    await expect(gateway.updateKey('key_missing', { label: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it("totals the project's own requests, by model, by key, and as attempts", async () => {
    const { gateway } = project();
    const a = await gateway.createKey({ label: 'usage-a' });
    const b = await gateway.createKey({ label: 'usage-b' });
    const elsewhere = await project(OTHER_PROJECT_ID).gateway.createKey({ label: 'other project' });
    // A day of its own, so requests made by the other tests don't count.
    const noon = Date.parse('2026-01-15T12:00:00.000Z');
    api.call(a.apiKey, 'openai/gpt-5-mini', noon);
    api.call(a.apiKey, 'mistral/mistral-large', noon);
    api.call(b.apiKey, 'openai/gpt-5-mini', noon);
    api.call(elsewhere.apiKey, 'openai/gpt-5-mini', noon);
    api.call(a.apiKey, 'openai/gpt-5-mini', Date.parse('2026-01-16T12:00:00.000Z'));
    const from = new Date('2026-01-15T00:00:00.000Z');
    const to = '2026-01-16T00:00:00.000Z';

    const byModel = await gateway.usage({ from, to, groupBy: 'model' });
    expect(Object.fromEntries(byModel.map(r => [r.dimension, r.requests]))).toEqual({
      'openai/gpt-5-mini': 2,
      'mistral/mistral-large': 1,
    });

    const [forA] = await gateway.usage({ from, to, keyId: a.keyId });
    expect(forA).toMatchObject({ dimension: null, requests: 2 });

    const [attempts] = await gateway.usage({ from, to, keyId: b.keyId, view: 'attempts' });
    expect(attempts).toMatchObject({ attempts: 1, totalTokens: { sum: 10 } });

    expect(api.usageQueries.every(q => q.get('projectId') === PROJECT_ID)).toBe(true);
    expect(api.usageQueries.at(-1)!.get('from')).toBe(from.toISOString());
  });

  it('lists the models keys of a region can call', async () => {
    const { gateway } = project();
    expect((await gateway.listModels()).map(m => m.id)).toEqual(['openai/gpt-5-mini', 'mistral/mistral-large']);
    expect((await gateway.listModels({ region: 'eu' })).map(m => m.id)).toEqual(['mistral/mistral-large']);
  });

  it("can't reach another project's keys, and surfaces a rejected token", async () => {
    const other = await project(OTHER_PROJECT_ID).gateway.createKey({ label: 'theirs' });
    const { gateway } = project();
    expect((await gateway.listKeys()).map(k => k.keyId)).not.toContain(other.keyId);
    await expect(gateway.revokeKey(other.keyId)).rejects.toMatchObject({ status: 404 });

    const error = await project(PROJECT_ID, 'bad')
      .gateway.listKeys()
      .catch(e => e);
    expect(error).toBeInstanceOf(MastraPlatformError);
    expect(error.status).toBe(401);
  });
});
