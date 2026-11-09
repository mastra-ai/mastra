import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./npm-placeholder-publish.mjs', import.meta.url));

function tempDir(t, prefix) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Mock npm registry: `packages` maps a package path to its GET status. Records
// every request so tests can assert nothing was (or what was) published.
// Trusted publishers POSTed to /-/package/<name>/trust are stored and served
// back on GET, like npm; `trust` seeds them and `dropTrust` discards POSTs.
async function startRegistry(t, { packages = {}, whoami = 200, trust = {}, dropTrust = false } = {}) {
  const requests = [];
  const trusted = new Map(Object.entries(trust));
  const server = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, body });
      if (req.url === '/-/whoami') {
        res.writeHead(whoami, { 'content-type': 'application/json' });
        res.end(JSON.stringify(whoami === 200 ? { username: 'npm-admin' } : { error: 'unauthorized' }));
      } else if (req.url.startsWith('/-/package/') && req.url.endsWith('/trust')) {
        if (req.method === 'POST' && !dropTrust) {
          const existing = trusted.get(req.url) ?? [];
          const added = JSON.parse(body).map((config, index) => ({ id: `cfg-${existing.length + index}`, ...config }));
          trusted.set(req.url, [...existing, ...added]);
        }
        res.writeHead(req.method === 'POST' ? 201 : 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(req.method === 'POST' ? { ok: true } : (trusted.get(req.url) ?? [])));
      } else if (req.method === 'PUT' || req.method === 'POST') {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      } else {
        res.writeHead(packages[req.url] ?? 404, { 'content-type': 'application/json' });
        res.end('{}');
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

function makeWorkspace(t) {
  const cwd = tempDir(t, 'npm-placeholder-ws-');
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  const packages = [
    { dir: 'sprites', manifest: { name: '@mastra/sprites', version: '0.1.0', license: 'Apache-2.0' } },
    { dir: 'playground', manifest: { name: '@internal/playground', version: '1.0.0', private: true } },
  ];
  for (const { dir, manifest } of packages) {
    mkdirSync(path.join(cwd, 'packages', dir, 'src'), { recursive: true });
    writeFileSync(path.join(cwd, 'packages', dir, 'package.json'), JSON.stringify(manifest));
    // Branch code that must never end up in the placeholder.
    writeFileSync(path.join(cwd, 'packages', dir, 'src', 'index.js'), 'export const secret = "unreviewed";\n');
  }
  return cwd;
}

// npm auth lives in an isolated userconfig pointing only at the mock registry,
// so these tests can never publish to the real npm registry.
function run(t, cwd, registry, args, input = '') {
  const npmrc = path.join(tempDir(t, 'npm-placeholder-rc-'), '.npmrc');
  writeFileSync(npmrc, `//${new URL(registry).host}/:_authToken=fake-token\n`);
  const env = { ...process.env, npm_config_userconfig: npmrc };
  for (const key of Object.keys(env)) {
    if (/^npm_config_(registry|_auth|.*token)/i.test(key)) delete env[key];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args, '--registry', registry], { cwd, env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr, output: stdout + stderr }));
    child.stdin.end(input);
  });
}

const puts = registry => registry.requests.filter(request => request.method === 'PUT');

test('refuses a name that is not a workspace package, without touching the registry', async t => {
  const registry = await startRegistry(t);
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/typo', '--skip-trust']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@mastra\/typo is not a package in this workspace/);
  assert.deepEqual(registry.requests, []);
});

test('--otp with no value is a usage error, and does not swallow the next flag', async t => {
  const registry = await startRegistry(t);
  // run() appends `--registry <url>`, so `--otp` is followed by a flag rather than a code.
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites', '--otp']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing value for --otp/);
  assert.deepEqual(registry.requests, []);
});

test('refuses a private workspace package', async t => {
  const registry = await startRegistry(t);
  const result = await run(t, makeWorkspace(t), registry.url, ['@internal/playground', '--skip-trust']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"private": true/);
  assert.deepEqual(registry.requests, []);
});

test('does nothing when the package already exists on npm', async t => {
  const registry = await startRegistry(t, { packages: { '/@mastra%2fsprites': 200 } });
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites', '--skip-trust']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /already exists .* no placeholder needed/);
  assert.deepEqual(puts(registry), []);
});

test('refuses to publish when the registry cannot be checked', async t => {
  const registry = await startRegistry(t, { packages: { '/@mastra%2fsprites': 500 } });
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites', '--skip-trust']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Could not check @mastra\/sprites/);
  assert.deepEqual(puts(registry), []);
});

test('refuses to publish when not logged in', async t => {
  const registry = await startRegistry(t, { whoami: 401 });
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites', '--skip-trust']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run `npm login`/);
  assert.deepEqual(puts(registry), []);
});

test('--dry-run packs the placeholder and prints the trust command without publishing', async t => {
  const registry = await startRegistry(t);
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites', '--dry-run']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /@mastra\/sprites@0\.0\.0/);
  assert.match(result.output, /total files:\s+2/);
  assert.match(
    result.stdout,
    /npx --yes npm@\^11\.15\.0 trust github @mastra\/sprites --file npm-publish\.yml --repo mastra-ai\/mastra --allow-publish/,
  );
  assert.deepEqual(puts(registry), []);
});

test('publishes an empty 0.0.0 placeholder containing no workspace code', async t => {
  const registry = await startRegistry(t);
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites', '--skip-trust']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /Published @mastra\/sprites@0\.0\.0 placeholder/);

  const [put] = puts(registry);
  assert.equal(put.url, '/@mastra%2fsprites');
  const document = JSON.parse(put.body);
  assert.deepEqual(Object.keys(document.versions), ['0.0.0']);
  assert.equal(document['dist-tags'].latest, '0.0.0');
  assert.equal(document.access, 'public');

  const tarball = path.join(tempDir(t, 'npm-placeholder-tgz-'), 'placeholder.tgz');
  writeFileSync(tarball, Buffer.from(Object.values(document._attachments)[0].data, 'base64'));
  const files = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).sort();
  assert.deepEqual(files, ['package/README.md', 'package/package.json']);

  const manifest = JSON.parse(
    spawnSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' }).stdout,
  );
  assert.equal(manifest.name, '@mastra/sprites');
  assert.equal(manifest.version, '0.0.0');
  assert.equal(manifest.license, 'Apache-2.0');
  // Prereleases publish under `alpha`, so `latest` stays on the placeholder
  // until the first stable release; installers must be pointed at @alpha.
  assert.match(manifest.description, /install @mastra\/sprites@alpha/);
  const readme = spawnSync('tar', ['-xzOf', tarball, 'package/README.md'], { encoding: 'utf8' }).stdout;
  assert.match(readme, /npm install @mastra\/sprites@alpha/);
});

// Runs the real `npm trust` (fetched via npx) against the mock registry.
test('configures trusted publishing for npm-publish.yml after publishing', async t => {
  const registry = await startRegistry(t);
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites'], 'y\n');
  assert.equal(result.status, 0, result.output);
  assert.match(
    result.stdout,
    /Trusted publishing configured for @mastra\/sprites: verified mastra-ai\/mastra npm-publish\.yml/,
  );

  const methods = registry.requests.map(request => `${request.method} ${request.url}`);
  const publishIndex = methods.indexOf('PUT /@mastra%2fsprites');
  const trustIndex = methods.indexOf('POST /-/package/@mastra%2fsprites/trust');
  assert.ok(publishIndex !== -1 && trustIndex > publishIndex, methods.join('\n'));
  assert.deepEqual(JSON.parse(registry.requests[trustIndex].body), [
    {
      type: 'github',
      claims: { repository: 'mastra-ai/mastra', workflow_ref: { file: 'npm-publish.yml' } },
      permissions: ['createPackage'],
    },
  ]);
});

const publishWorkflowTrust = {
  type: 'github',
  claims: { repository: 'mastra-ai/mastra', workflow_ref: { file: 'npm-publish.yml' } },
  permissions: ['createPackage'],
};

test('fails when npm does not report the trusted publisher after configuring it', async t => {
  const registry = await startRegistry(t, { dropTrust: true });
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites'], 'y\n');
  assert.equal(result.status, 1, result.output);
  assert.match(
    result.stderr,
    /npm reports no trusted publisher for mastra-ai\/mastra npm-publish\.yml on @mastra\/sprites .*found: none/,
  );
});

test('an existing package with the right trusted publisher is left alone', async t => {
  const registry = await startRegistry(t, {
    packages: { '/@mastra%2fsprites': 200 },
    trust: { '/-/package/@mastra%2fsprites/trust': [{ id: 'cfg-0', ...publishWorkflowTrust }] },
  });
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /already configured for @mastra\/sprites/);
  assert.deepEqual(puts(registry), []);
  assert.ok(!registry.requests.some(request => request.method === 'POST'));
});

test('an existing package trusting another workflow gets npm-publish.yml added and verified', async t => {
  const otherWorkflow = {
    id: 'cfg-0',
    type: 'github',
    claims: { repository: 'mastra-ai/mastra', workflow_ref: { file: 'old-release.yml' } },
    permissions: ['createPackage'],
  };
  const registry = await startRegistry(t, {
    packages: { '/@mastra%2fsprites': 200 },
    trust: { '/-/package/@mastra%2fsprites/trust': [otherWorkflow] },
  });
  const result = await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites'], 'y\n');
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /currently trusts: github mastra-ai\/mastra old-release\.yml/);
  assert.match(result.stdout, /verified mastra-ai\/mastra npm-publish\.yml/);
  assert.deepEqual(puts(registry), []);
});

async function runWithExistingTrust(t, config) {
  const registry = await startRegistry(t, {
    packages: { '/@mastra%2fsprites': 200 },
    trust: { '/-/package/@mastra%2fsprites/trust': [{ id: 'cfg-0', ...config }] },
  });
  return { registry, result: await run(t, makeWorkspace(t), registry.url, ['@mastra/sprites'], 'y\n') };
}

test('a stage-only trusted publisher for npm-publish.yml is reported as unable to publish', async t => {
  const { registry, result } = await runWithExistingTrust(t, {
    ...publishWorkflowTrust,
    permissions: ['createStagedPackage'],
  });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.stdout, /already configured/);
  assert.match(result.stderr, /cfg-0: it allows only createStagedPackage, not publishing \(createPackage\)/);
  assert.match(result.stderr, /npx npm@\^11\.15\.0 trust revoke @mastra\/sprites --id cfg-0/);
  assert.ok(!registry.requests.some(request => request.method === 'POST'));
});

test('a trusted publisher restricted to a GitHub environment is reported as unable to publish', async t => {
  const { registry, result } = await runWithExistingTrust(t, {
    ...publishWorkflowTrust,
    claims: { ...publishWorkflowTrust.claims, environment: 'production' },
  });
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.stdout, /already configured/);
  assert.match(result.stderr, /cfg-0: it is restricted to GitHub environment "production"/);
  assert.match(result.stderr, /trust revoke @mastra\/sprites --id cfg-0/);
  assert.ok(!registry.requests.some(request => request.method === 'POST'));
});

test('a trusted publisher from before npm had permissions is accepted', async t => {
  const { permissions, ...legacy } = publishWorkflowTrust;
  const { registry, result } = await runWithExistingTrust(t, legacy);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /already configured for @mastra\/sprites/);
  assert.ok(!registry.requests.some(request => request.method === 'POST'));
});
