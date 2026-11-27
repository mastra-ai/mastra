import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MastraProject } from './mastra-platform';
import { MastraPlatformError } from './provisioning/index';

const TOKEN = 'org-key';
const PROJECT_ID = 'proj_1';
const SECRET = '__mastra_secret__';

type Env = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  branch: string | null;
  envVars: Record<string, string> | null;
  deletedAt: string | null;
};
type Deploy = { id: string; environmentId: string; status: string; logs: string };

/**
 * A stand-in for the Platform's environment routes (`/v1/projects/:projectId/environments/...`).
 * Like the real API, it keeps variables whose names end in `_KEY` secret: they read back as
 * `__mastra_secret__`, and a PATCH that sends that value keeps the stored one. A delete can be
 * undone until it is torn down; an immediate delete tears it down at once.
 */
function environmentsApi() {
  const environments = new Map<string, Env>();
  const stored = new Map<string, Record<string, string>>();
  const deploys = new Map<string, Deploy>();
  let nextId = 1;

  const wire = (env: Env) => {
    const vars = stored.get(env.id);
    const { deletedAt: _, ...rest } = env;
    return {
      ...rest,
      envVars: vars
        ? Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, k.endsWith('_KEY') ? SECRET : v]))
        : null,
      managedEnvVarNames: ['DATABASE_URL'],
    };
  };
  const save = (envId: string, vars: Record<string, string>) => {
    const previous = stored.get(envId) ?? {};
    stored.set(envId, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v === SECRET ? previous[k]! : v])));
  };

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
    const m = url.pathname.match(/^\/v1\/projects\/([^/]+)\/environments(?:\/([^/]+))?(\/.*)?$/);
    if (!m || m[1] !== PROJECT_ID) return send(404, { error: 'Project not found' });
    const [, , envId, rest = ''] = m;
    const method = req.method ?? 'GET';

    if (!envId) {
      if (method === 'GET') {
        return send(200, { environments: [...environments.values()].filter(e => !e.deletedAt).map(wire) });
      }
      const env: Env = {
        id: `env_${nextId++}`,
        projectId: PROJECT_ID,
        name: body.name,
        type: body.type,
        branch: body.branch ?? null,
        envVars: null,
        deletedAt: null,
      };
      environments.set(env.id, env);
      if (body.envVars) save(env.id, body.envVars);
      return send(201, { environment: wire(env) });
    }

    const env = environments.get(envId);
    if (!env) return send(404, { error: 'Environment not found' });
    if (rest === '/undelete' && method === 'POST') {
      if (!env.deletedAt) return send(409, { detail: 'Environment is not deleted' });
      env.deletedAt = null;
      return send(200, { ok: true, environment: wire(env) });
    }
    if (env.deletedAt) return send(404, { error: 'Environment not found' });

    if (rest === '') {
      if (method === 'GET') return send(200, { environment: wire(env), workloadIdentity: null });
      if (method === 'PATCH') {
        if (body.name !== undefined) env.name = body.name;
        if (body.branch !== undefined) env.branch = body.branch;
        if (body.envVars !== undefined) save(env.id, body.envVars ?? {});
        return send(200, { environment: wire(env) });
      }
      if (method === 'DELETE') {
        const deletedAt = new Date().toISOString();
        if (url.searchParams.get('immediate') === 'true') {
          environments.delete(env.id);
          return send(200, { success: true, deletedAt, undoUntil: null });
        }
        env.deletedAt = deletedAt;
        return send(200, { success: true, deletedAt, undoUntil: '2026-11-29T00:00:00.000Z' });
      }
    }
    const own = [...deploys.values()].filter(d => d.environmentId === env.id);
    if (rest === '/restart' && method === 'POST') {
      if (own.length === 0) return send(409, { detail: 'Environment has never been deployed' });
      return send(200, { id: own[0]!.id, status: 'deploying' });
    }
    if (rest === '/deploys' && method === 'GET') {
      return send(200, { deploys: own.reverse().map(({ logs: _, ...d }) => d) });
    }
    const dm = rest.match(/^\/deploys\/([^/]+)(\/logs|\/cancel)?$/);
    const deploy = dm && deploys.get(dm[1]!);
    if (!deploy || deploy.environmentId !== env.id) return send(404, { detail: 'Deploy not found' });
    if (!dm![2] && method === 'GET') {
      const { logs: _, ...d } = deploy;
      return send(200, { deploy: { ...d, publicUrls: null } });
    }
    if (dm![2] === '/logs') return send(200, { logs: deploy.logs });
    if (deploy.status !== 'queued') return send(400, { detail: 'Deploy can no longer be cancelled' });
    deploy.status = 'cancelled';
    return send(200, { id: deploy.id, status: deploy.status });
  });

  return {
    server,
    /** The variables as stored, secrets included. */
    stored: (envId: string) => stored.get(envId),
    deploy(environmentId: string, status: string, logs = '') {
      const deploy = { id: `deploy_${nextId++}`, environmentId, status, logs };
      deploys.set(deploy.id, deploy);
      return deploy.id;
    },
    get apiUrl() {
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    },
  };
}

const api = environmentsApi();
beforeAll(() => new Promise<void>(resolve => api.server.listen(0, '127.0.0.1', resolve)));
afterAll(() => new Promise(resolve => api.server.close(resolve)));

const project = (accessToken = TOKEN) => new MastraProject({ accessToken, projectId: PROJECT_ID, apiUrl: api.apiUrl });

describe('MastraProject environments', () => {
  it('creates an environment, gets it, and renames and rebinds it', async () => {
    const { environments } = project();
    const created = await environments.create({ name: 'Staging', type: 'staging', branch: 'develop' });
    expect(await environments.get(created.id)).toMatchObject({
      name: 'Staging',
      type: 'staging',
      branch: 'develop',
      managedEnvVarNames: ['DATABASE_URL'],
    });

    const updated = await environments.update(created.id, { name: 'QA', branch: null });
    expect(updated).toMatchObject({ name: 'QA', branch: null });
    expect((await environments.list()).map(env => env.name)).toContain('QA');
  });

  it('sets and removes some variables, keeping the others and the stored secrets', async () => {
    const { environments } = project();
    const env = await environments.create({
      name: 'Vars',
      type: 'preview',
      envVars: { LOG_LEVEL: 'info', OPENAI_API_KEY: 'sk-real', REGION: 'us' },
    });
    expect(env.envVars).toEqual({ LOG_LEVEL: 'info', OPENAI_API_KEY: SECRET, REGION: 'us' });

    const set = await environments.setVars(env.id, { LOG_LEVEL: 'debug', STRIPE_KEY: 'sk-stripe' });
    expect(set.envVars).toEqual({ LOG_LEVEL: 'debug', OPENAI_API_KEY: SECRET, REGION: 'us', STRIPE_KEY: SECRET });

    await environments.unsetVars(env.id, ['REGION']);
    expect(api.stored(env.id)).toEqual({ LOG_LEVEL: 'debug', OPENAI_API_KEY: 'sk-real', STRIPE_KEY: 'sk-stripe' });
  });

  it('sets the first variables of an environment that has none', async () => {
    const { environments } = project();
    const env = await environments.create({ name: 'Empty', type: 'preview' });
    expect(env.envVars).toBeNull();

    await environments.setVars(env.id, { PORT: '4111' });
    expect(api.stored(env.id)).toEqual({ PORT: '4111' });
  });

  it('deletes an environment, restores it, and deletes it for good', async () => {
    const { environments } = project();
    const env = await environments.create({ name: 'Doomed', type: 'preview' });

    expect(await environments.delete(env.id)).toEqual({
      deletedAt: expect.any(String),
      undoUntil: '2026-11-29T00:00:00.000Z',
    });
    await expect(environments.get(env.id)).rejects.toMatchObject({ status: 404 });
    expect(await environments.restore(env.id)).toMatchObject({ id: env.id, name: 'Doomed' });

    expect(await environments.delete(env.id, { immediate: true })).toMatchObject({ undoUntil: null });
    await expect(environments.restore(env.id)).rejects.toMatchObject({ status: 404 });
  });

  it("reads an environment's deploys and logs, cancels a queued one, and restarts the server", async () => {
    const { environments } = project();
    const env = await environments.create({ name: 'Deployed', type: 'production' });
    await expect(environments.restart(env.id)).rejects.toThrow('never been deployed');

    const running = api.deploy(env.id, 'running', 'Build succeeded\nListening on :4111');
    const queued = api.deploy(env.id, 'queued');

    expect((await environments.listDeploys(env.id)).map(d => [d.id, d.status])).toEqual([
      [queued, 'queued'],
      [running, 'running'],
    ]);
    expect(await environments.getDeploy(env.id, running)).toMatchObject({ id: running, status: 'running' });
    expect(await environments.deployLogs(env.id, running)).toContain('Listening on :4111');

    expect(await environments.cancelDeploy(env.id, queued)).toEqual({ id: queued, status: 'cancelled' });
    await expect(environments.cancelDeploy(env.id, running)).rejects.toThrow('can no longer be cancelled');
    expect(await environments.restart(env.id)).toMatchObject({ status: 'deploying' });
  });

  it("can't reach another environment's deploy, and surfaces a rejected token", async () => {
    const { environments } = project();
    const a = await environments.create({ name: 'A', type: 'preview' });
    const b = await environments.create({ name: 'B', type: 'preview' });
    const deploy = api.deploy(a.id, 'running');
    await expect(environments.getDeploy(b.id, deploy)).rejects.toMatchObject({ status: 404 });

    const error = await project('bad')
      .environments.list()
      .catch(e => e);
    expect(error).toBeInstanceOf(MastraPlatformError);
    expect(error.status).toBe(401);
  });
});
