import { configuredOrganizations } from '../../src/billing/configuration/environment.js';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { createClient } from '@libsql/client';
import { expect } from 'vitest';
import { readLocalProfiles } from '../../src/billing/providers/local/profiles.js';

export const templateRoot = fileURLToPath(new URL('../../', import.meta.url));
export function sanitizedEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT', 'LANG'])
    if (process.env[key]) environment[key] = process.env[key];
  return {
    ...environment,
    PATH: `${dirname(process.execPath)}:${environment.PATH}`,
    MASTRA_TELEMETRY_DISABLED: 'true',
    DO_NOT_TRACK: '1',
    CI: 'true',
  };
}
const npmPath =
  process.env.npm_execpath ??
  process.env.PATH?.split(delimiter)
    .map(directory => join(directory, 'npm'))
    .find(filename => existsSync(filename));
if (!npmPath) throw new Error('The npm CLI must be installed and available on PATH.');
const npmCli = realpathSync(npmPath);
export async function command(
  root: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  success = true,
  timeoutMs = 600000,
) {
  const child = spawn(process.execPath, [npmCli, ...args], {
    cwd: root,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output = (output + chunk).slice(-32000);
  });
  child.stderr.on('data', chunk => {
    output = (output + chunk).slice(-32000);
  });
  let timedOut = false;
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      /* Already stopped. */
    }
  }, timeoutMs);
  try {
    const [code, signal] = await once(child, 'close');
    if (timedOut || signal)
      throw new Error(
        `Template command ${args.join(' ')} ${timedOut ? 'timed out' : `terminated by ${signal}`}: ${output}`,
      );
    if (success && code !== 0) throw new Error(`Template command ${args.join(' ')} failed (${code}): ${output}`);
    return { code, output };
  } finally {
    globalThis.clearTimeout(timer);
  }
}
export async function templateCopy(install = false) {
  const root = await mkdtemp(join(tmpdir(), 'image-template-'));
  const excluded = new Set(['node_modules', 'data', '.env', '.mastra', 'dist', 'coverage', '.git', '.vscode']);
  await cp(templateRoot, root, {
    recursive: true,
    filter: source => {
      const name = source.slice(templateRoot.length).split('/').filter(Boolean)[0] ?? '';
      return !excluded.has(name) && (!name.startsWith('.env') || name === '.env.example') && !source.endsWith('.log');
    },
  });
  if (!install) await symlink(join(templateRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}
export async function profileManifest(root: string) {
  return (await readLocalProfiles(root))!;
}
export async function query(root: string, sql: string, args: (string | number)[] = []) {
  const client = createClient({ url: (await profileManifest(root)).databaseUrl });
  try {
    return (await client.execute({ sql, args })).rows;
  } finally {
    client.close();
  }
}
export async function serve(
  root: string,
  env: NodeJS.ProcessEnv,
  mode: 'dev' | 'start' = 'dev',
  credential?: string,
  startupTimeoutMs = 90000,
) {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const environment = { ...env, BILLING_PORT: String(address.port) };
  const manifest = await profileManifest(root);
  const deadline = performance.now() + startupTimeoutMs;
  const startup = AbortSignal.timeout(startupTimeoutMs);
  const child = spawn(process.execPath, [npmCli, 'run', mode], {
    cwd: root,
    env: environment,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (chunk: Buffer) => {
    output = (output + chunk).slice(-32000);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  const exited = once(child, 'exit');
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {
      return;
    }
    await Promise.race([exited, setTimeout(2000)]);
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      /* Already stopped. */
    }
    await exited;
  };
  const url = `http://127.0.0.1:${address.port}`;
  const call = async (
    path: string,
    body?: unknown,
    profile: 'owner' | 'member' | 'outsider' = 'owner',
    key = 'image-request',
    signal: AbortSignal = AbortSignal.timeout(30000),
  ) => {
    const response = await fetch(`${url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal,
      headers: {
        authorization: `Bearer ${credential ?? manifest.profiles[profile]!.credential}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  try {
    while (!startup.aborted && performance.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Template server exited: ${output}`);
      try {
        if ((await call('/billing/context', undefined, 'owner', 'image-request', startup)).status === 200)
          return { url, call, close, manifest, environment };
      } catch {
        /* Server warming up. */
      }
      await setTimeout(Math.max(0, Math.min(100, deadline - performance.now())));
    }
    throw new Error(`Template server did not start: ${output}`);
  } catch (error) {
    await close();
    throw error;
  }
}
export async function assertNativeClosed(server: Awaited<ReturnType<typeof serve>>, executionId = 'unknown') {
  for (const path of [
    '/api/agents',
    '/api/agents/image-agent/generate',
    '/api/agents/image-agent/stream',
    '/api/workflows/image-kit/start',
    `/api/workflows/image-kit/runs/${executionId}`,
    '/api/memory/threads',
    '/.well-known/agent.json',
    '/',
  ]) {
    const response = await fetch(`${server.url}${path}`, {
      method: path.includes('generate') || path.includes('stream') || path.endsWith('/start') ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${server.manifest.profiles.owner!.credential}`,
        'content-type': 'application/json',
      },
      ...(path.includes('generate') || path.includes('stream') || path.endsWith('/start') ? { body: '{}' } : {}),
    });
    expect(response.status, path).toBe(403);
    expect(await response.text()).toContain('billing_gateway_required');
  }
}

export async function shareOwnerWorkspace(root: string) {
  const manifest = await profileManifest(root);
  const organizations = await configuredOrganizations({
    MASTRA_PROJECT_ROOT: root,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
  });
  try {
    const owner = manifest.profiles.owner!,
      member = manifest.profiles.member!;
    const context = await organizations.context({ credential: owner.credential, workspaceId: owner.workspaceId });
    await organizations.convert(context, 'shared-regression-convert');
    const invitation = await organizations.invite(context, 'shared-regression-invite', {
      recipientId: member.actorId,
      role: 'member',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    if (!invitation.token) throw new Error('Expected a new invitation');
    await organizations.acceptInvitation({
      credential: member.credential,
      key: 'shared-regression-accept',
      token: invitation.token,
    });
  } finally {
    organizations.close();
  }
}
