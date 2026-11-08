import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { createClient } from '@libsql/client';
import { expect } from 'vitest';
import { readLocalProfiles } from '../../src/local/profiles.js';

export const templateRoot = fileURLToPath(new URL('../../', import.meta.url));
export const observations = {
  location: 'Porto Alegre',
  observedAt: '2026-11-08T12:00:00Z',
  temperatureC: 24,
  feelsLikeC: 26,
  humidityPercent: 70,
  windKph: 18,
  precipitationChancePercent: 60,
  conditions: 'Cloudy with showers possible',
};
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
const npmCli = resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
export async function command(root: string, args: string[], env: NodeJS.ProcessEnv, success = true) {
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
  const timer = globalThis.setTimeout(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      /* Already stopped. */
    }
  }, 600000);
  const [code] = await once(child, 'exit');
  globalThis.clearTimeout(timer);
  if (success && code !== 0) throw new Error(`Template command ${args.join(' ')} failed (${code}): ${output}`);
  return { code, output };
}
export async function templateCopy(install = false) {
  const root = await mkdtemp(join(tmpdir(), 'weather-template-'));
  const excluded = new Set(['node_modules', 'data', '.env', '.mastra', 'dist', 'coverage', '.git']);
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
export async function serve(root: string, env: NodeJS.ProcessEnv, mode: 'dev' | 'start' = 'dev') {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const environment = { ...env, BILLING_PORT: String(address.port) };
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
  };
  const url = `http://127.0.0.1:${address.port}`;
  const manifest = await profileManifest(root);
  const call = async (
    path: string,
    body?: unknown,
    profile: 'owner' | 'member' | 'outsider' = 'owner',
    key = 'weather-request',
  ) => {
    const response = await fetch(`${url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        authorization: `Bearer ${manifest.profiles[profile]!.credential}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  try {
    for (let attempt = 0; attempt < 900; attempt++) {
      if (child.exitCode !== null) throw new Error(`Template server exited: ${output}`);
      try {
        if ((await call('/billing/context')).status === 200) return { url, call, close, manifest, environment };
      } catch {
        /* Server warming up. */
      }
      await setTimeout(100);
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
    '/api/agents/weather-agent/generate',
    '/api/agents/weather-agent/stream',
    '/api/workflows/weather-report/start',
    `/api/workflows/weather-report/runs/${executionId}`,
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
