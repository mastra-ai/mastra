import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { finished } from 'node:stream/promises';

import { createClient } from 'redis';

import { expectedCells, readCellEvidence, summarizeEvidence } from '../src/stream-harness/report';
import { SCENARIO_GROUPS } from '../src/stream-harness/scenarios';
import type { ScenarioGroup } from '../src/stream-harness/scenarios';
import { createProxy } from '../src/stream-harness/toxiproxy';

const groups: ScenarioGroup[] = ['chunks', 'lifecycle', 'faults'];
const directory = resolve(process.env.STREAM_HARNESS_EVIDENCE_DIR ?? mkdtempSync(join(tmpdir(), 'stream-harness-ci-')));
mkdirSync(directory, { recursive: true });
const save = (file: string, value: unknown) =>
  writeFileSync(join(directory, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
save('manifest.json', { groups, cells: expectedCells(groups) });
save('provenance.json', {
  at: new Date().toISOString(),
  pid: process.pid,
  node: process.version,
  head: git('rev-parse', 'HEAD'),
  diffSha256: createHash('sha256').update(git('diff', 'HEAD')).digest('hex'),
  status: git('status', '--short'),
  sourceHashes: Object.fromEntries(
    git(
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      'src/stream-harness',
      'test-fixtures',
      'package.json',
      'tsconfig.qualification.json',
    )
      .split('\n')
      .filter(Boolean)
      .map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]),
  ),
  scripts: groups.map(group => `pnpm run test:stream-harness:${group} --maxWorkers=1 --retry=0 --reporter=dot`),
});
console.log(`Stream harness evidence: ${directory}`);

async function readiness() {
  if (process.env.SKIP_REDIS_TESTS === '1') throw new Error('SKIP_REDIS_TESTS cannot qualify a required matrix');
  const api = process.env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474';
  const version = await fetch(`${api}/version`, { signal: AbortSignal.timeout(5_000) });
  if (!version.ok) throw new Error(`Toxiproxy readiness HTTP ${version.status}`);
  const inventory = await fetch(`${api}/proxies`, { signal: AbortSignal.timeout(5_000) });
  if (!inventory.ok) throw new Error(`Toxiproxy inventory HTTP ${inventory.status}`);
  const proxies: unknown = await inventory.json();
  if (!proxies || typeof proxies !== 'object' || Array.isArray(proxies) || Object.keys(proxies).length) {
    throw new Error('Toxiproxy must be reachable and have no active proxies');
  }
  save('toxiproxy-version.json', await version.json());
  for (const backend of ['redis', 'valkey'] as const) {
    const proxy = await createProxy(backend);
    try {
      const client = createClient({
        url: proxy.url.replace('valkey:', 'redis:'),
        socket: { reconnectStrategy: false, connectTimeout: 5_000 },
      });
      client.on('error', error => console.error(`${backend} readiness: ${error.message}`));
      const timeout = setTimeout(() => {
        if (client.isOpen) client.destroy();
      }, 10_000);
      try {
        await client.connect();
        if ((await client.ping()) !== 'PONG') throw new Error(`${backend} proxy PING failed`);
        const info = await client.info('server');
        save(`${backend}-readiness.json`, {
          ping: 'PONG',
          version: info.split('\r\n').filter(line => /^(redis|valkey)_version:/.test(line)),
        });
      } finally {
        clearTimeout(timeout);
        if (client.isOpen) client.destroy();
      }
    } finally {
      await proxy.close();
    }
  }
}

let interrupted = false;
async function run(group: ScenarioGroup) {
  const out = createWriteStream(join(directory, `${group}.stdout.txt`), { flags: 'wx' });
  const err = createWriteStream(join(directory, `${group}.stderr.txt`), { flags: 'wx' });
  const child = spawn(
    'pnpm',
    ['run', `test:stream-harness:${group}`, '--maxWorkers=1', '--retry=0', '--reporter=dot'],
    {
      env: { ...process.env, STREAM_HARNESS_EVIDENCE_DIR: directory },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    },
  );
  child.stdout.pipe(out);
  child.stderr.pipe(err);
  child.stdout.pipe(process.stdout, { end: false });
  child.stderr.pipe(process.stderr, { end: false });
  save(`${group}.started.json`, { pid: child.pid, at: new Date().toISOString(), scenarios: SCENARIO_GROUPS[group] });
  const forward = (signal: NodeJS.Signals) => {
    interrupted = true;
    if (child.pid) process.kill(-child.pid, signal);
  };
  const terminate = () => forward('SIGTERM');
  const interrupt = () => forward('SIGINT');
  process.once('SIGTERM', terminate);
  process.once('SIGINT', interrupt);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    await Promise.all([finished(out), finished(err)]);
    save(`${group}.result.json`, { code, interrupted, at: new Date().toISOString() });
    if (interrupted) throw new Error(`Interrupted during ${group}; later groups were not started`);
    return code;
  } finally {
    process.off('SIGTERM', terminate);
    process.off('SIGINT', interrupt);
  }
}

let exit = 0;
try {
  await readiness();
  // Retain every group's result, but never turn a failed group into a successful job.
  for (const group of groups) {
    if ((await run(group)) !== 0) exit = 1;
  }
  const inventory = await fetch(`${process.env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474'}/proxies`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!inventory.ok) throw new Error(`Final proxy inventory HTTP ${inventory.status}`);
  const remaining: unknown = await inventory.json();
  save('final-proxies.json', remaining);
  if (!remaining || typeof remaining !== 'object' || Array.isArray(remaining) || Object.keys(remaining).length) {
    throw new Error('Harness left proxies behind; cleanup is incomplete');
  }
  const summary = summarizeEvidence(expectedCells(groups), readCellEvidence(directory), exit);
  save('summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.exitCode;
} catch (error) {
  save('infrastructure-error.json', { at: new Date().toISOString(), message: String(error) });
  console.error('PROOF: BLOCKED — stream harness evidence or infrastructure failure', error);
  process.exitCode = 1;
}
