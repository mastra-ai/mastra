import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { parsePublishLog } from './check-npm-published-versions.mjs';

const script = fileURLToPath(new URL('./check-npm-published-versions.mjs', import.meta.url));
const fixture = name => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Mock npm registry: routes map URL path (`/@scope%2fname/<version>`) to a
// status, or to an array of statuses consumed one request at a time (last one
// sticks). Unknown paths are 200 (live), so tests only list what is not.
async function startRegistry(t, routes = {}) {
  const remaining = new Map(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    const statuses = remaining.get(req.url);
    const status = statuses ? (statuses.length > 1 ? statuses.shift() : statuses[0]) : 200;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

function writeLog(t, text) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-npm-published-versions-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'publish.log');
  writeFileSync(file, text);
  return file;
}

// Async spawn: the mock registry lives in this process.
function run(log, registry, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, log, '--registry', registry, ...extraArgs]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

const publishedLines = [
  '📦 @mastra/core@1.78.0 → https://registry.npmjs.org/',
  '✅ Published package @mastra/core@1.78.0',
  '📦 mastra@1.34.2 → https://registry.npmjs.org/',
  '✅ Published package mastra@1.34.2',
].join('\n');

test('parses published and staged-conflict lines, ignoring ANSI colour and CI prefixes', () => {
  const { published, staged } = parsePublishLog(
    [
      '2026-10-15T21:42:14.8721766Z \u001b[32m✅ Published package @mastra/core@1.78.0\u001b[39m',
      '✅ Published package mastra@1.34.2',
      '✅ Published package mastra@1.34.2',
      '✅ Published package @mastra/core@0.0.0-snapshot-20261015',
      '[E409] 409 Conflict - PUT https://registry.npmjs.org/@mastra%2fmemory - Cannot publish over previously staged version "1.38.0".',
      '[E409] 409 Conflict - PUT https://registry.npmjs.org/mastra - Cannot publish over previously staged version "1.34.2".',
      'WARN Skip publishing @mastra/dynamodb@1.4.3 (dry run)',
    ].join('\n'),
  );
  assert.deepEqual(published, [
    { name: '@mastra/core', version: '1.78.0' },
    { name: 'mastra', version: '1.34.2' },
    { name: '@mastra/core', version: '0.0.0-snapshot-20261015' },
  ]);
  assert.deepEqual(staged, [
    { name: '@mastra/memory', version: '1.38.0' },
    { name: 'mastra', version: '1.34.2' },
  ]);
});

test('passes when every reported version is live', async t => {
  const registry = await startRegistry(t);
  const result = await run(writeLog(t, publishedLines), registry.url);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All 2 reported version\(s\) are live on npm/);
  assert.deepEqual(registry.requests.sort(), ['/@mastra%2fcore/1.78.0', '/mastra/1.34.2']);
});

test('passes with nothing to check when pnpm published nothing (dry run, or all already published)', async t => {
  const registry = await startRegistry(t);
  const result = await run(writeLog(t, 'WARN Skip publishing @mastra/core@1.78.0 (dry run)\n'), registry.url);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /nothing to check/);
  assert.equal(registry.requests.length, 0);
});

test('fails with npm stage approve instructions when a reported version never goes live', async t => {
  const registry = await startRegistry(t, { '/@mastra%2fcore/1.78.0': 404 });
  const started = Date.now();
  const result = await run(writeLog(t, publishedLines), registry.url, ['--retry-missing', '1500']);
  assert.equal(result.status, 1, result.stdout);
  assert.ok(Date.now() - started < 10_000, 'gives up at the --retry-missing deadline');
  assert.match(result.stdout, /::error title=Staged, not published::@mastra\/core@1\.78\.0/);
  assert.match(result.stderr, /✘ @mastra\/core@1\.78\.0/);
  assert.doesNotMatch(result.stderr, /✘ mastra@/);
  assert.match(result.stderr, /npx npm@\^11\.15\.0 stage list @mastra\/core/);
  assert.match(result.stderr, /stage approve <stage-id>/);
  assert.ok(registry.requests.filter(url => url === '/@mastra%2fcore/1.78.0').length > 1, 're-checks the 404');
  assert.equal(registry.requests.filter(url => url === '/mastra/1.34.2').length, 1, 'does not re-check live versions');
});

test('passes when a reported version appears within the lag window', async t => {
  const registry = await startRegistry(t, { '/@mastra%2fcore/1.78.0': [404, 404, 200] });
  const result = await run(writeLog(t, publishedLines), registry.url, ['--retry-missing', '3000']);
  assert.equal(result.status, 0, result.stderr);
});

test('fails straight away on an E409 staged conflict, without waiting out the lag window', async t => {
  const registry = await startRegistry(t, { '/@mastra%2fcore/1.78.0': 404 });
  const log = writeLog(
    t,
    '[E409] 409 Conflict - PUT https://registry.npmjs.org/@mastra%2fcore - Cannot publish over previously staged version "1.78.0".\n',
  );
  const started = Date.now();
  const result = await run(log, registry.url, ['--retry-missing', '60000']);
  assert.equal(result.status, 1, result.stdout);
  assert.ok(Date.now() - started < 10_000, `took ${Date.now() - started}ms`);
  assert.match(result.stderr, /✘ @mastra\/core@1\.78\.0/);
  assert.match(result.stderr, /E409/);
});

test('an E409 staged version that has been approved since is not reported', async t => {
  const registry = await startRegistry(t);
  const log = writeLog(
    t,
    '[E409] 409 Conflict - PUT https://registry.npmjs.org/@mastra%2fcore - Cannot publish over previously staged version "1.78.0".\n',
  );
  const result = await run(log, registry.url);
  assert.equal(result.status, 0, result.stderr);
});

test('exits 2 when the registry keeps erroring', async t => {
  const registry = await startRegistry(t, { '/@mastra%2fcore/1.78.0': 503 });
  const result = await run(writeLog(t, publishedLines), registry.url);
  assert.equal(result.status, 2, result.stdout);
  assert.match(result.stderr, /Could not verify 1 version\(s\).*@mastra\/core@1\.78\.0/);
});

test('rejects a missing log argument or flag value', async t => {
  const registry = await startRegistry(t);
  assert.equal((await run('--retry-missing', registry.url)).status, 2);
  const result = await run(writeLog(t, publishedLines), registry.url, ['--retry-missing']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Missing value for --retry-missing/);
});

// Replays of stable 1.78.0, run 38809638764 (Oct 2026), from the real log lines.
test('replay attempt 1: flags @mastra/core@1.78.0, which pnpm reported as published but npm only staged', async t => {
  // Registry state at the time: core 1.78.0 staged (404), everything else live.
  const registry = await startRegistry(t, { '/@mastra%2fcore/1.78.0': 404 });
  const result = await run(fixture('publish-1.78.0-attempt1.log'), registry.url, ['--retry-missing', '500']);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /Checking 25 version\(s\) pnpm reported as published/);
  assert.match(result.stderr, /^1 version\(s\) are staged on npm, not published:\n {2}✘ @mastra\/core@1\.78\.0$/m);
});

test('replay attempt 2: explains the E409 as a staged version needing approval', async t => {
  const registry = await startRegistry(t, { '/@mastra%2fcore/1.78.0': 404 });
  const result = await run(fixture('publish-1.78.0-attempt2.log'), registry.url);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /✘ @mastra\/core@1\.78\.0/);
  assert.match(result.stderr, /stage approve/);
});
