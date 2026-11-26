import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MastraPlatform } from './mastra-platform';
import { MastraPlatformError } from './provisioning/index';

const ORG_ID = 'org_1';
const SESSIONS: Record<string, 'admin' | 'member'> = { 'admin-session': 'admin', 'member-session': 'member' };

type Row = { id: string; status: string; error: string | null; reads: number; [field: string]: unknown };

/**
 * A stand-in for the Platform's control plane (`/v1/server/projects/...` and `/v1/projects/.../environments`).
 * Like the real API it acts for the signed-in user in the organization named by `x-organization-id`,
 * keeps Memory, Knowledge and database writes to organization admins, answers creates with a
 * `provisioning` row that turns `ready` (or `failed`) on later reads, and only lets a project's
 * resources be reached through that project.
 */
function platformControlPlane() {
  const projects = new Map<string, { id: string; name: string; slug: string; organizationId: string }>();
  const environments = new Map<string, { id: string; projectId: string; name: string; type: string }>();
  const resources = new Map<string, Row & { projectId: string; type: string }>();
  let agentsSetup: 'none' | 'provisioning' | 'ready' = 'none';
  let agentsSetupReads = 0;
  let nextId = 1;

  /** A provisioning row becomes ready on its second read, or failed when it carries `fail`. */
  function read(row: Row) {
    row.reads += 1;
    if (row.status === 'provisioning' && row.reads >= 2) {
      row.status = row.fail ? 'failed' : 'ready';
      row.error = row.fail ? String(row.fail) : null;
    }
    const { reads: _reads, fail: _fail, projectId: _p, type: _t, ...wire } = row;
    return wire;
  }

  function provision(projectId: string, type: string, fields: Record<string, unknown>) {
    const row = {
      id: `${type}_${nextId++}`,
      projectId,
      type,
      status: 'provisioning',
      error: null,
      reads: 0,
      createdAt: '2026-11-26T00:00:00.000Z',
      updatedAt: '2026-11-26T00:00:00.000Z',
      ...fields,
    };
    resources.set(row.id, row);
    return row;
  }

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const method = req.method ?? 'GET';
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, data === undefined ? {} : { 'content-type': 'application/json' });
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };

    const role = SESSIONS[(req.headers.authorization ?? '').replace(/^Bearer /, '')];
    if (!role) return send(401, { error: 'Unauthorized' });
    if (req.headers['x-organization-id'] !== ORG_ID) return send(403, { error: 'Organization access required' });
    const adminOnly = () => {
      if (role === 'admin') return false;
      // The Platform API answers with problem details, not `{ error }`.
      send(403, {
        type: 'authorization_error',
        title: 'Forbidden',
        status: 403,
        detail: 'Missing permission: org:settings:manage',
      });
      return true;
    };

    let m: RegExpMatchArray | null;
    if (path === '/v1/server/projects') {
      if (method === 'GET') return send(200, { projects: [...projects.values()] });
      const id = `proj_${nextId++}`;
      const project = { id, name: body.name, slug: body.name.toLowerCase(), organizationId: ORG_ID };
      projects.set(id, project);
      const production = { id: `env_${nextId++}`, projectId: id, name: 'Production', type: 'production' };
      environments.set(production.id, production);
      return send(200, { project, deploys: [] });
    }

    const projectMatch = path.match(/^\/v1\/(?:server\/)?projects\/([^/]+)(\/.*)?$/);
    if (!projectMatch) return send(404, { error: 'Not found' });
    const [, projectId, rest = ''] = projectMatch;
    if (!projects.has(projectId!)) return send(404, { error: 'Server project not found' });
    const owned = (id: string, type: string) => {
      const row = resources.get(id);
      return row && row.projectId === projectId && row.type === type ? row : undefined;
    };

    if (rest === '') {
      if (method === 'GET') return send(200, { project: projects.get(projectId!) });
      if (method === 'DELETE') {
        projects.delete(projectId!);
        return send(200, { ok: true });
      }
    }

    if (path.startsWith('/v1/projects/') && rest === '/environments') {
      const own = [...environments.values()].filter(env => env.projectId === projectId);
      if (method === 'GET') return send(200, { environments: own });
      const env = { id: `env_${nextId++}`, projectId: projectId!, name: body.name, type: body.type };
      environments.set(env.id, env);
      return send(201, { environment: env });
    }

    for (const [segment, type, key] of [
      ['memory', 'memory', 'instance'],
      ['knowledge', 'knowledge', 'instance'],
      ['databases', 'database', 'database'],
    ] as const) {
      if (rest === `/${segment}`) {
        if (method === 'GET') {
          const rows = [...resources.values()].filter(r => r.projectId === projectId && r.type === type).map(read);
          return send(200, { [key === 'instance' ? 'instances' : 'databases']: rows });
        }
        if (adminOnly()) return;
        if (type === 'memory' && !/^[a-z0-9][a-z0-9-]*$/.test(body?.name ?? '')) {
          return send(400, { error: 'Use lowercase letters, numbers and dashes' });
        }
        const row = provision(projectId!, type, {
          ...body,
          ...(body?.name === 'broken' ? { fail: 'upstream provider rejected the database' } : {}),
        });
        return send(type === 'database' ? 201 : 202, { [key]: read({ ...row, reads: -1 }) });
      }
      if ((m = rest.match(new RegExp(`^/${segment}/([^/]+)(/connection)?$`)))) {
        const row = owned(m[1]!, type);
        if (!row) return send(404, { error: 'Not found' });
        if (method === 'DELETE') {
          if (adminOnly()) return;
          resources.delete(row.id);
          return send(200, { ok: true });
        }
        if (m[2]) {
          if (row.status !== 'ready') return send(409, { error: 'Database is not ready' });
          return send(200, {
            envVars: [{ name: 'DATABASE_URL', value: `libsql://${row.name}.example`, secret: true }],
            snippets: [],
            docsUrl: 'https://mastra.ai/docs',
          });
        }
        return send(200, { [key]: read(row) });
      }
    }

    if ((m = rest.match(/^\/environments\/([^/]+)\/buckets(?:\/([^/]+))?$/))) {
      const env = environments.get(m[1]!);
      if (!env || env.projectId !== projectId) return send(404, { error: 'Environment not found' });
      if (!m[2]) {
        if (method === 'GET') {
          return send(
            200,
            [...resources.values()].filter(r => r.type === 'bucket' && r.environmentId === env.id).map(read),
          );
        }
        const row = provision(projectId!, 'bucket', { environmentId: env.id, name: body.name, provider: 'neon' });
        return send(202, read({ ...row, reads: -1 }));
      }
      const row = owned(m[2], 'bucket');
      if (!row || row.environmentId !== env.id) return send(404, { error: 'Bucket not found' });
      resources.delete(row.id);
      return send(204);
    }
    if ((m = rest.match(/^\/buckets\/([^/]+)$/))) {
      const row = owned(m[1]!, 'bucket');
      return row ? send(200, read(row)) : send(404, { error: 'Bucket not found' });
    }

    if (rest === '/agents/setup') {
      if (method === 'POST') {
        if (agentsSetup === 'none') agentsSetup = 'provisioning';
        return send(agentsSetup === 'ready' ? 200 : 202, { ready: agentsSetup === 'ready' });
      }
      agentsSetupReads += 1;
      if (agentsSetup === 'provisioning' && agentsSetupReads >= 2) agentsSetup = 'ready';
      return send(200, { status: agentsSetup });
    }

    return send(404, { error: 'Not found' });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(err => {
      res.writeHead(500).end(String(err));
    });
  });
  return {
    server,
    get apiUrl() {
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    },
  };
}

const platformApi = platformControlPlane();
const wait = { intervalMs: 1, timeoutMs: 1_000 };

beforeAll(() => new Promise<void>(resolve => platformApi.server.listen(0, '127.0.0.1', resolve)));
afterAll(() => new Promise(resolve => platformApi.server.close(resolve)));
beforeEach(() => {
  delete process.env.MASTRA_PROJECT_ID;
  delete process.env.MASTRA_ORG_ID;
});

function signedIn(session = 'admin-session') {
  return new MastraPlatform({ accessToken: session, organizationId: ORG_ID, apiUrl: platformApi.apiUrl });
}

describe('MastraPlatform project provisioning', () => {
  it('creates a project and provisions memory, knowledge, a database and a file system that are ready to use', async () => {
    const platform = signedIn();
    const created = await platform.projects.create({ name: 'Support Bot' });
    expect(await platform.projects.list()).toContainEqual(created);

    const project = platform.project(created.id);
    const [production] = await project.environments.list();
    expect(production).toMatchObject({ type: 'production' });

    const memory = await project.memoryInstances.create({ name: 'support-memory' });
    expect(memory.status).toBe('provisioning');
    expect(await project.memoryInstances.waitUntilReady(memory.id, wait)).toMatchObject({
      id: memory.id,
      name: 'support-memory',
      status: 'ready',
    });

    const knowledge = await project.knowledgeInstances.create();
    expect((await project.knowledgeInstances.waitUntilReady(knowledge.id, wait)).status).toBe('ready');

    const database = await project.databases.create({ kind: 'turso', name: 'support-db' });
    await project.databases.waitUntilReady(database.id, wait);
    expect((await project.databases.connection(database.id)).envVars).toEqual([
      { name: 'DATABASE_URL', value: 'libsql://support-db.example', secret: true },
    ]);

    const filesystem = await project.filesystems.create({ environmentId: production!.id, name: 'uploads' });
    expect(await project.filesystems.waitUntilReady(filesystem.id, wait)).toMatchObject({
      name: 'uploads',
      environmentId: production!.id,
      status: 'ready',
    });
    expect((await project.filesystems.list(production!.id)).map(fs => fs.id)).toEqual([filesystem.id]);
  });

  it('removes what it provisioned, and the project itself', async () => {
    const platform = signedIn();
    const project = platform.project((await platform.projects.create({ name: 'Scratch' })).id);
    const [production] = await project.environments.list();
    const memory = await project.memoryInstances.create({ name: 'scratch' });
    const filesystem = await project.filesystems.create({ environmentId: production!.id, name: 'tmp' });

    await project.memoryInstances.delete(memory.id);
    await project.filesystems.delete(filesystem);
    expect(await project.memoryInstances.list()).toEqual([]);
    expect(await project.filesystems.list(production!.id)).toEqual([]);

    await platform.projects.delete(project.projectId);
    await expect(platform.projects.get(project.projectId)).rejects.toMatchObject({ status: 404 });
  });

  it('creates another environment for preview resources', async () => {
    const platform = signedIn();
    const project = platform.project((await platform.projects.create({ name: 'Envs' })).id);
    const preview = await project.environments.create({ name: 'Preview', type: 'preview' });
    expect((await project.environments.list()).map(env => env.id)).toContain(preview.id);
  });

  it('sets a project up for managed agents and waits until it is ready', async () => {
    const platform = signedIn();
    const project = platform.project((await platform.projects.create({ name: 'Agents' })).id);
    expect(await project.agentsSetupStatus()).toBe('none');
    await project.setupAgents(wait);
    expect(await project.agentsSetupStatus()).toBe('ready');
  });

  it('reports why provisioning failed instead of waiting forever', async () => {
    const project = signedIn().project((await signedIn().projects.create({ name: 'Broken' })).id);
    const database = await project.databases.create({ kind: 'turso', name: 'broken' });
    await expect(project.databases.waitUntilReady(database.id, wait)).rejects.toThrow(
      `Database ${database.id} is failed: upstream provider rejected the database`,
    );
  });

  it("surfaces the Platform's reason when a member who is not an admin provisions memory", async () => {
    const projectId = (await signedIn().projects.create({ name: 'Members' })).id;
    const member = signedIn('member-session').project(projectId);
    const error = await member.memoryInstances.create({ name: 'mem' }).catch(e => e);
    expect(error).toBeInstanceOf(MastraPlatformError);
    expect(error).toMatchObject({ status: 403 });
    expect(error.message).toContain('Missing permission: org:settings:manage');
  });

  it('acts in the organization from MASTRA_ORG_ID, and is refused without one', async () => {
    const withoutOrg = new MastraPlatform({ accessToken: 'admin-session', apiUrl: platformApi.apiUrl });
    await expect(withoutOrg.projects.list()).rejects.toMatchObject({ status: 403 });

    process.env.MASTRA_ORG_ID = ORG_ID;
    const fromEnv = new MastraPlatform({ accessToken: 'admin-session', apiUrl: platformApi.apiUrl });
    await expect(fromEnv.projects.list()).resolves.toBeInstanceOf(Array);
  });

  it("cannot reach another project's resources through a project it was pointed at", async () => {
    const platform = signedIn();
    const a = platform.project((await platform.projects.create({ name: 'A' })).id);
    const b = platform.project((await platform.projects.create({ name: 'B' })).id);
    const memory = await a.memoryInstances.create({ name: 'private' });
    await expect(b.memoryInstances.get(memory.id)).rejects.toMatchObject({ status: 404 });
  });
});
