import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { WebSocketServer } from 'ws';

export const TOKEN = 'user-session';
export const ORG_ID = 'org_1';

type Row = { id: string; projectId: string; type: string; status: string; error: null; [field: string]: unknown };
type Sandbox = {
  id: string;
  projectId: string;
  environmentId: string;
  status: 'ready' | 'destroyed';
  provider: 'railway';
  request?: Record<string, unknown>;
};

/**
 * A stand-in for Mastra Platform: the control-plane API, the workspace proxy, and the Railway
 * shell that runs sandbox commands over a WebSocket. Like the real services it acts for the
 * signed-in user (the control plane also wants the organization in `x-organization-id`), answers
 * provisioning with a `provisioning` row that turns `ready` when read, refuses an agent run that
 * names no end user, and only lets a command into a sandbox with that sandbox's exec lease.
 */
export async function startPlatformApi() {
  const projects = new Map<string, { id: string; name: string; slug: string; organizationId: string }>();
  const environments: { id: string; projectId: string; name: string; slug: string; type: string }[] = [];
  const resources = new Map<string, Row>();
  const agents = new Map<
    string,
    { id: string; projectId: string; name: string; instructions: string; [field: string]: unknown }
  >();
  const setups = new Map<string, 'none' | 'provisioning' | 'ready'>();
  const sandboxes = new Map<string, Sandbox>();
  const threads = new Map<string, { resource: string; messages: string[] }>();
  const commands: { sandboxId: string; command: string; cwd?: string }[] = [];
  let nextId = 1;
  let url = '';

  const ready = (row: Row) => {
    row.status = 'ready';
    const { projectId: _p, type: _t, ...wire } = row;
    return wire;
  };

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const method = req.method ?? 'GET';
    const { pathname: path, searchParams } = new URL(req.url ?? '/', 'http://localhost');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    const send = (status: number, data?: unknown) => {
      res.writeHead(status, data === undefined ? {} : { 'content-type': 'application/json' });
      res.end(data === undefined ? undefined : JSON.stringify(data));
    };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'Unauthorized' });
    let m: RegExpMatchArray | null;

    // —— Workspace proxy: the user's token reaches any project in their organization ——
    if ((m = path.match(/^\/v1\/railway\/projects\/([^/]+)\/sandbox(?:\/([^/]+))?(\/exec-lease)?$/))) {
      const [, projectId, sandboxId, lease] = m;
      if (!projects.has(projectId!)) return send(404, { error: { type: 'not_found', message: 'Project not found' } });
      if (!sandboxId && method === 'POST') {
        if (!environments.some(e => e.id === body.environmentId && e.projectId === projectId)) {
          return send(400, { error: { type: 'invalid_request', message: 'Unknown environment' } });
        }
        const sandbox: Sandbox = {
          id: `sbx_${nextId++}`,
          projectId: projectId!,
          environmentId: body.environmentId,
          status: 'ready',
          provider: 'railway',
          request: body,
        };
        sandboxes.set(sandbox.id, sandbox);
        return send(201, { id: sandbox.id, createdAt: new Date().toISOString() });
      }
      const sandbox = sandboxId ? sandboxes.get(sandboxId) : undefined;
      if (!sandbox || sandbox.projectId !== projectId || sandbox.status === 'destroyed') {
        return send(404, { error: { type: 'not_found', message: 'Sandbox not found' } });
      }
      if (lease && method === 'POST') {
        return send(200, {
          provider: 'railway',
          sandboxId,
          providerResourceId: `rw_${sandboxId}`,
          jwt: `lease-${sandboxId}`,
          wsEndpoint: `${url.replace(/^http/, 'ws')}/ws/exec`,
          subprotocol: 'railway-shell',
          expiresAt: '2030-01-01T00:00:00.000Z',
        });
      }
      if (method === 'GET') return send(200, { id: sandbox.id, createdAt: new Date().toISOString() });
      if (method === 'DELETE') {
        sandbox.status = 'destroyed';
        return send(204);
      }
    }
    if (path.startsWith('/v1/railway/')) return send(404, { error: { type: 'not_found', message: 'Not found' } });

    // —— Control plane ——
    if (req.headers['x-organization-id'] !== ORG_ID) return send(403, { error: 'Organization access required' });

    if (path === '/v1/server/projects') {
      if (method === 'GET') return send(200, { projects: [...projects.values()] });
      const id = `proj_${nextId++}`;
      const slug = String(body.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      projects.set(id, { id, name: body.name, slug, organizationId: ORG_ID });
      environments.push({
        id: `env_${nextId++}`,
        projectId: id,
        name: 'Production',
        slug: 'production',
        type: 'production',
      });
      setups.set(id, 'none');
      return send(200, { project: projects.get(id) });
    }

    m = path.match(/^\/v1\/(?:server\/)?projects\/([^/]+)(\/.*)?$/);
    const projectId = m?.[1];
    if (!m || !projectId || !projects.has(projectId)) return send(404, { error: 'Server project not found' });
    const rest = m[2] ?? '';

    if (rest === '' && method === 'DELETE') {
      projects.delete(projectId);
      return send(200, { ok: true });
    }
    if (rest === '/environments')
      return send(200, { environments: environments.filter(e => e.projectId === projectId) });

    if (rest === '/agents/setup') {
      if (method === 'POST') {
        setups.set(projectId, setups.get(projectId) === 'ready' ? 'ready' : 'provisioning');
        return send(202, { ready: false });
      }
      if (setups.get(projectId) === 'provisioning') setups.set(projectId, 'ready');
      return send(200, { status: setups.get(projectId) });
    }
    if (rest.startsWith('/agents') && setups.get(projectId) !== 'ready') {
      return send(409, { error: 'Managed agents are not set up for this project' });
    }
    if (rest === '/agents') {
      const own = [...agents.values()].filter(a => a.projectId === projectId);
      if (method === 'GET') return send(200, Object.fromEntries(own.map(a => [a.id, { name: a.name }])));
      const agent = { ...body, id: `agent_${nextId++}`, projectId, name: body.name, instructions: body.instructions };
      agents.set(agent.id, agent);
      return send(201, agent);
    }
    if ((m = rest.match(/^\/agents\/([^/]+)$/)) && method === 'DELETE') {
      if (agents.get(m[1]!)?.projectId !== projectId) return send(404, { error: 'Agent not found' });
      agents.delete(m[1]!);
      return send(204);
    }
    if ((m = rest.match(/^\/agents\/([^/]+)\/stream$/))) {
      const agent = agents.get(m[1]!);
      if (!agent || agent.projectId !== projectId) return send(404, { error: 'Agent not found' });
      if (typeof body?.resourceId !== 'string') return send(400, { error: 'resourceId is required' });
      // Memory: a thread belongs to one end user and remembers what they said in it.
      const thread = body.memory?.thread as string | undefined;
      const history = thread
        ? (threads.get(thread) ?? { resource: body.resourceId as string, messages: [] as string[] })
        : undefined;
      if (history && history.resource !== body.resourceId)
        return send(403, { error: 'Thread belongs to another user' });
      const earlier = history?.messages.at(-1);
      if (thread && history) {
        history.messages.push(String(body.messages));
        threads.set(thread, history);
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const reply = [`${agent.name} here. `, `You asked: ${body.messages}`];
      if (earlier) reply.push(` (earlier you said: ${earlier})`);
      for (const text of reply) {
        const chunk = { type: 'text-delta', runId: 'run_1', from: 'AGENT', payload: { id: 't', text } };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.end('data: [DONE]\n\n');
      return;
    }

    if ((m = rest.match(/^\/environments\/([^/]+)\/sandboxes$/))) {
      const list = [...sandboxes.values()].filter(s => s.environmentId === m![1] && s.projectId === projectId);
      return send(200, { sandboxes: list, hasMore: false, total: list.length, pageSize: 20 });
    }
    if ((m = rest.match(/^\/sandboxes\/([^/]+)$/))) {
      const sandbox = sandboxes.get(m[1]!);
      return sandbox?.projectId === projectId ? send(200, sandbox) : send(404, { error: 'Sandbox not found' });
    }

    for (const [segment, type, key] of [
      ['memory', 'memory', 'instance'],
      ['knowledge', 'knowledge', 'instance'],
    ] as const) {
      if (rest === `/${segment}`) {
        if (method === 'GET') {
          const rows = [...resources.values()].filter(r => r.projectId === projectId && r.type === type);
          return send(200, { instances: rows.map(ready) });
        }
        const row: Row = { id: `${type}_${nextId++}`, projectId, type, status: 'provisioning', error: null, ...body };
        resources.set(row.id, row);
        const { projectId: _p, type: _t, ...wire } = row;
        return send(202, { [key]: wire });
      }
      if ((m = rest.match(new RegExp(`^/${segment}/([^/]+)$`)))) {
        const row = resources.get(m[1]!);
        if (!row || row.projectId !== projectId) return send(404, { error: 'Not found' });
        if (method === 'DELETE') {
          resources.delete(row.id);
          return send(200, { ok: true });
        }
        return send(200, { [key]: ready(row) });
      }
    }

    if ((m = rest.match(/^\/environments\/([^/]+)\/buckets$/))) {
      if (!environments.some(e => e.id === m![1] && e.projectId === projectId)) {
        return send(404, { error: 'Environment not found' });
      }
      if (method === 'GET') {
        return send(
          200,
          [...resources.values()].filter(r => r.type === 'bucket' && r.environmentId === m![1]).map(ready),
        );
      }
      const row: Row = {
        id: `fs_${nextId++}`,
        projectId,
        type: 'bucket',
        status: 'provisioning',
        error: null,
        environmentId: m[1],
        name: body.name,
      };
      resources.set(row.id, row);
      return send(202, { ...row });
    }
    if ((m = rest.match(/^\/buckets\/([^/]+)$/))) {
      const row = resources.get(m[1]!);
      return row?.projectId === projectId ? send(200, ready(row)) : send(404, { error: 'Bucket not found' });
    }

    return send(404, { error: `No route for ${method} ${path}${searchParams.size ? `?${searchParams}` : ''}` });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(err => res.writeHead(500).end(String(err)));
  });

  // The provider shell: frames are a 1-byte stream tag (1 stdout, 3 stderr) plus the bytes, then an exit frame.
  const shell = new WebSocketServer({ server, path: '/ws/exec', handleProtocols: () => 'railway-shell' });
  shell.on('connection', (socket, req) => {
    const offered = String(req.headers['sec-websocket-protocol'] ?? '').split(/,\s*/);
    const sandbox = [...sandboxes.values()].find(s => offered.includes(`lease-${s.id}`) && s.status === 'ready');
    if (!sandbox) return socket.close(4401, 'invalid lease');
    socket.on('message', (data, isBinary) => {
      if (isBinary) return;
      const frame = JSON.parse(String(data)) as {
        type: string;
        data?: { command: string; cwd?: string; env?: Record<string, string> };
      };
      if (frame.type !== 'init_exec') return;
      // A `--cwd` arrives as a `cd` preamble on its own line ahead of the command, as the SDK sends it.
      const lines = frame.data!.command.split('\n');
      const command = lines.at(-1)!;
      const cwd = lines.length > 1 ? lines[0]!.match(/cd -- '?([^' ]+)'? \|\|/)?.[1] : frame.data!.cwd;
      commands.push({ sandboxId: sandbox.id, command, ...(cwd ? { cwd } : {}) });
      const [program, ...args] = command.split(' ');
      const out = (tag: number, text: string) => socket.send(Buffer.concat([Buffer.from([tag]), Buffer.from(text)]));
      let exitCode = 0;
      if (program === 'echo') out(1, `${args.join(' ')}\n`);
      else if (program === 'pwd') out(1, `${cwd ?? '/home/user'}\n`);
      else if (program === 'printenv') out(1, `${frame.data!.env?.[args[0]!] ?? ''}\n`);
      else if (program === 'sleep')
        return; // Never finishes: the caller has to give up on it.
      else {
        out(3, `${program}: command not found\n`);
        exitCode = 127;
      }
      socket.send(JSON.stringify({ type: 'exit', data: { exit_code: exitCode } }));
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url,
    projects,
    environments,
    resources,
    agents,
    sandboxes,
    commands,
    threads,
    close: () =>
      new Promise<void>(resolve => {
        shell.close();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

const ENTRY = fileURLToPath(new URL('../../../index.ts', import.meta.url));
const TSX = fileURLToPath(new URL('../../../../node_modules/.bin/tsx', import.meta.url));

/** Runs the real `mastra` entry point the way a user's shell would, signed in to the stand-in Platform. */
export async function mastraCli(platformUrl: string) {
  const home = await mkdtemp(join(tmpdir(), 'mastra-cli-home-'));
  const cwd = await mkdtemp(join(tmpdir(), 'mastra-cli-cwd-'));
  const env: Record<string, string> = {
    HOME: home,
    PATH: process.env.PATH ?? '',
    CI: '1',
    MASTRA_TELEMETRY_DISABLED: '1',
    MASTRA_API_TOKEN: TOKEN,
    MASTRA_ORG_ID: ORG_ID,
    MASTRA_PLATFORM_API_URL: platformUrl,
    MASTRA_WORKSPACE_PROXY_URL: platformUrl,
    // The stand-in shell speaks Railway's exec protocol; E2B (the default) uses E2B's own transport.
    SANDBOX_PROVIDER: 'railway',
  };

  function run(args: string[], extraEnv: Record<string, string> = {}, input?: string) {
    return execa(TSX, [ENTRY, ...args], {
      cwd,
      ...(input === undefined ? {} : { input }),
      env: { ...env, ...extraEnv },
      extendEnv: false,
      reject: false,
      timeout: 60_000,
    });
  }

  return {
    env,
    run,
    /** Runs with `--json`, expects success, and parses the output. */
    async json<T>(args: string[], extraEnv?: Record<string, string>): Promise<T> {
      const result = await run([...args, '--json'], extraEnv);
      if (result.exitCode !== 0) throw new Error(`mastra ${args.join(' ')} failed: ${result.stderr}`);
      return JSON.parse(result.stdout) as T;
    },
  };
}
