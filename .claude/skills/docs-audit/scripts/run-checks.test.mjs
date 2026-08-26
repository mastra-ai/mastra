import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), 'run-checks.sh');

async function createFixture({ vale = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'docs-audit-checker-test-'));
  const docs = join(root, 'docs');
  const bin = join(root, 'bin');
  const tempRoot = join(root, 'tmp');
  const log = join(root, 'commands.log');
  const files = [
    'src/content/en/docs/index.mdx',
    'src/content/en/docs/server/pubsub.mdx',
    'src/content/en/integrations/deploy/render.mdx',
    'src/content/en/reference/core/getAgentById.mdx',
  ];
  for (const file of files) {
    await mkdir(dirname(join(docs, file)), { recursive: true });
    await writeFile(join(docs, file), '# Fixture\n');
  }
  await mkdir(bin, { recursive: true });
  await mkdir(tempRoot, { recursive: true });
  await writeFile(
    join(bin, 'pnpm'),
    `#!/usr/bin/env bash
printf 'pnpm|%s\\n' "$*" >> "$MOCK_LOG"
case "$*" in
  'exec oxfmt-mdx --check '*) printf '%s' "${'${MOCK_FORMAT_OUTPUT:-}'}"; exit "${'${MOCK_FORMAT_CODE:-0}'}" ;;
  'exec remark --no-stdout --frail --quiet --ext mdx '*) printf '%s' "${'${MOCK_REMARK_OUTPUT:-}'}"; exit "${'${MOCK_REMARK_CODE:-0}'}" ;;
  validate) printf '%s' "${'${MOCK_VALIDATE_OUTPUT:-}'}"; exit "${'${MOCK_VALIDATE_CODE:-0}'}" ;;
  *) echo "unexpected pnpm command: $*" >&2; exit 127 ;;
esac
`,
  );
  await chmod(join(bin, 'pnpm'), 0o755);
  if (vale) {
    const valePath = join(docs, 'scripts/vale/bin/vale');
    await mkdir(dirname(valePath), { recursive: true });
    await writeFile(
      valePath,
      `#!/usr/bin/env bash
printf 'vale|%s\\n' "$*" >> "$MOCK_LOG"
printf '%s' "${'${MOCK_VALE_OUTPUT:-}'}"
exit "${'${MOCK_VALE_CODE:-0}'}"
`,
    );
    await chmod(valePath, 0o755);
  }
  return { root, docs, bin, tempRoot, log };
}

async function runFixture(options = {}) {
  const fixture = await createFixture({ vale: options.vale });
  const args = options.args ?? [
    '--docs',
    'docs/src/content/en/docs/index.mdx',
    '--docs',
    'docs/src/content/en/integrations/deploy/render.mdx',
    '--docs',
    'docs/src/content/en/reference/core/getAgentById.mdx',
  ];
  const outside = join(fixture.root, 'outside');
  await mkdir(outside);
  const result = spawnSync('bash', [scriptPath, ...args], {
    cwd: outside,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fixture.bin}:${process.env.PATH}`,
      DOCS_AUDIT_WORKTREE_ROOT: fixture.root,
      DOCS_AUDIT_DOCS_DIR: fixture.docs,
      DOCS_AUDIT_TMP_ROOT: fixture.tempRoot,
      MOCK_LOG: fixture.log,
      ...options.env,
    },
  });
  const commands = await readFile(fixture.log, 'utf8').catch(() => '');
  const tempEntries = await readdir(fixture.tempRoot);
  return { ...fixture, result, commands, tempEntries };
}

async function cleanupFixture(fixture) {
  await rm(fixture.root, { recursive: true, force: true });
}

function assertSummary(stdout, expected = {}) {
  const values = {
    'format-target': 'pass',
    'remark-target': 'pass',
    'vale-target': 'pass',
    'validate-target': 'pass',
    'repo-wide-failures': 'none',
    ...expected,
  };
  for (const [key, value] of Object.entries(values)) assert.match(stdout, new RegExp(`^${key}=${value}$`, 'm'));
}

test('requires at least one audited docs path', () => {
  const result = spawnSync('bash', [scriptPath], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--docs requires at least one doc path/);
});

test('runs only the retained commands for multiple page types from outside the repository', async () => {
  const fixture = await runFixture();
  try {
    assert.equal(fixture.result.status, 0, fixture.result.stderr);
    assertSummary(fixture.result.stdout);
    assert.deepEqual(fixture.tempEntries, []);
    assert.match(
      fixture.commands,
      /pnpm\|exec oxfmt-mdx --check src\/content\/en\/docs\/index\.mdx src\/content\/en\/integrations\/deploy\/render\.mdx src\/content\/en\/reference\/core\/getAgentById\.mdx/,
    );
    assert.match(
      fixture.commands,
      /pnpm\|exec remark --no-stdout --frail --quiet --ext mdx src\/content\/en\/docs\/index\.mdx src\/content\/en\/integrations\/deploy\/render\.mdx src\/content\/en\/reference\/core\/getAgentById\.mdx/,
    );
    assert.match(
      fixture.commands,
      /vale\|--minAlertLevel=error --output=line src\/content\/en\/docs\/index\.mdx src\/content\/en\/integrations\/deploy\/render\.mdx src\/content\/en\/reference\/core\/getAgentById\.mdx/,
    );
    assert.match(fixture.commands, /^pnpm\|validate$/m);
    assert.doesNotMatch(fixture.commands, /lint:remark|lint:vale|install|typecheck/);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('prints target diagnostics and exits nonzero for format failures', async () => {
  const fixture = await runFixture({
    env: { MOCK_FORMAT_CODE: '1', MOCK_FORMAT_OUTPUT: 'index.mdx needs formatting\n' },
  });
  try {
    assert.equal(fixture.result.status, 1);
    assert.match(fixture.result.stdout, /format-target diagnostics:\n  index\.mdx needs formatting/);
    assertSummary(fixture.result.stdout, { 'format-target': 'fail' });
    assert.deepEqual(fixture.tempEntries, []);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('prints target diagnostics and exits nonzero for Remark failures', async () => {
  const fixture = await runFixture({ env: { MOCK_REMARK_CODE: '1', MOCK_REMARK_OUTPUT: 'index.mdx:3:1 warning\n' } });
  try {
    assert.equal(fixture.result.status, 1);
    assert.match(fixture.result.stdout, /remark-target diagnostics:\n  index\.mdx:3:1 warning/);
    assertSummary(fixture.result.stdout, { 'remark-target': 'fail' });
  } finally {
    await cleanupFixture(fixture);
  }
});

test('warns without failing when the optional Vale binary is missing', async () => {
  const fixture = await runFixture({ vale: false });
  try {
    assert.equal(fixture.result.status, 0);
    assert.match(fixture.result.stdout, /Vale binary missing/);
    assertSummary(fixture.result.stdout, { 'vale-target': 'warn' });
  } finally {
    await cleanupFixture(fixture);
  }
});

test('prints target diagnostics and exits nonzero for Vale failures', async () => {
  const fixture = await runFixture({ env: { MOCK_VALE_CODE: '1', MOCK_VALE_OUTPUT: 'render.mdx:4:2:style error\n' } });
  try {
    assert.equal(fixture.result.status, 1);
    assert.match(fixture.result.stdout, /vale-target diagnostics:\n  render\.mdx:4:2:style error/);
    assertSummary(fixture.result.stdout, { 'vale-target': 'fail' });
  } finally {
    await cleanupFixture(fixture);
  }
});

for (const [label, output] of [
  ['path', 'Invalid frontmatter: src/content/en/docs/server/pubsub.mdx\n'],
  ['doc ID', 'Missing sidebar item: server/pubsub\n'],
  ['route', 'Broken route: /docs/server/pubsub\n'],
]) {
  test(`attributes validation failure to the audited target by ${label}`, async () => {
    const fixture = await runFixture({
      args: ['--docs', 'docs/src/content/en/docs/server/pubsub.mdx'],
      env: { MOCK_VALIDATE_CODE: '1', MOCK_VALIDATE_OUTPUT: output },
    });
    try {
      assert.equal(fixture.result.status, 1);
      assert.match(fixture.result.stdout, /validate-target diagnostics:/);
      assertSummary(fixture.result.stdout, { 'validate-target': 'fail' });
    } finally {
      await cleanupFixture(fixture);
    }
  });
}

test('reports proven unrelated repository validation failures without failing the audited target', async () => {
  const fixture = await runFixture({
    env: {
      MOCK_VALIDATE_CODE: '1',
      MOCK_VALIDATE_OUTPUT:
        'Found 1 sidebar "new" tag older than 30 days:\n  src/content/en/docs/sidebars.js:7 "Regions" (mastra-platform/regions)\n',
    },
  });
  try {
    assert.equal(fixture.result.status, 0);
    assertSummary(fixture.result.stdout, { 'repo-wide-failures': 'validate' });
    assert.doesNotMatch(fixture.result.stdout, /validate-target diagnostics:/);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('marks unattributed validation failures as warnings and preserves their output', async () => {
  const fixture = await runFixture({
    env: { MOCK_VALIDATE_CODE: '1', MOCK_VALIDATE_OUTPUT: 'Validation failed without a path or route\n' },
  });
  try {
    assert.equal(fixture.result.status, 0);
    assert.match(fixture.result.stdout, /validate-target diagnostics:\n  Validation failed without a path or route/);
    assertSummary(fixture.result.stdout, {
      'validate-target': 'warn',
      'repo-wide-failures': 'validate-ambiguous',
    });
  } finally {
    await cleanupFixture(fixture);
  }
});

test('rejects files outside docs', async () => {
  const fixture = await runFixture({ args: ['--docs', 'outside.mdx'] });
  try {
    assert.equal(fixture.result.status, 2);
    assert.match(fixture.result.stderr, /doc must be under docs|doc file does not exist/);
    assert.deepEqual(fixture.tempEntries, []);
  } finally {
    await cleanupFixture(fixture);
  }
});

test('exits nonzero for checker execution failures and still removes temporary output', async () => {
  const fixture = await runFixture({
    env: { MOCK_FORMAT_CODE: '127', MOCK_FORMAT_OUTPUT: 'oxfmt-mdx: command not found\n' },
  });
  try {
    assert.equal(fixture.result.status, 1);
    assert.match(fixture.result.stderr, /checker execution failed with exit code 127/);
    assertSummary(fixture.result.stdout, { 'format-target': 'fail' });
    assert.deepEqual(fixture.tempEntries, []);
  } finally {
    await cleanupFixture(fixture);
  }
});
