import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-changeset-packages.mjs', import.meta.url));

function validate(t, frontmatter) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'check-changeset-packages-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  for (const name of ['@mastra/core', '@mastra/playground-ui', '@internal/auth', '@internal/playground', 'mastra']) {
    const dir = path.join(cwd, 'packages', name.replaceAll('/', '-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', private: name.startsWith('@internal/') }),
    );
  }
  mkdirSync(path.join(cwd, '.changeset'));
  writeFileSync(
    path.join(cwd, '.changeset/config.json'),
    JSON.stringify({ ignore: ['*', '@internal/*', '!mastra', '!@mastra/*', '!@internal/playground'] }),
  );
  writeFileSync(path.join(cwd, '.changeset/README.md'), '# Not a changeset');
  if (frontmatter !== undefined) {
    writeFileSync(path.join(cwd, '.changeset/test-change.md'), `---\n${frontmatter}\n---\n\nTest change.\n`);
  }
  const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

test('accepts a repository without pending changesets', t => {
  const result = validate(t);
  assert.equal(result.status, 0, result.stderr);
});

test('accepts release packages and explicit internal ignore exceptions', t => {
  const result = validate(
    t,
    '"@mastra/core": patch\n"@mastra/playground-ui": minor\n"@internal/playground": patch\n"mastra": patch',
  );
  assert.equal(result.status, 0, result.stderr);
});

for (const name of ['@internal/core', '@internal/playground-ui']) {
  test(`rejects unknown package ${name}`, t => {
    const result = validate(t, `"${name}": patch`);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`.changeset/test-change.md: unknown workspace package "${name}"`), result.stderr);
  });
}

test('rejects an ignored-only changeset even though the package exists', t => {
  const result = validate(t, '"@internal/auth": patch');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /test-change\.md: package "@internal\/auth" is ignored/);
});

test('rejects ignored packages mixed with release packages', t => {
  const result = validate(t, '"@internal/auth": patch\n"@mastra/core": patch');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"@internal\/auth" is ignored/);
});

test('rejects malformed frontmatter', t => {
  const result = validate(t, '"@mastra/core": [');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /could not parse changeset/);
});
