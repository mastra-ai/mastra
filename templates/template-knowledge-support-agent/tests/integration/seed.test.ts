import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { cp, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test, { after, before } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { KnowledgeLibSQL, LibSQLStore } from '@mastra/libsql';
import type { Knowledge, KnowledgeStorage } from '@mastra/core/knowledge';
import { createKnowledge } from '../../src/mastra/knowledge/index.ts';
import { acquireWriterLock } from '../../src/mastra/knowledge/writer-lock.ts';
import { seedDataset, seedDatasetOnce, type SeedReport } from '../../src/mastra/knowledge/seed.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { principals } from '../../src/mastra/identity.ts';
import { exampleProfiles } from '../../src/examples/retail-pos/profiles.ts';
import { approvePolicyRevision, localTestDatabaseEnvironment } from '../fixtures/runtime.ts';

const execute = promisify(execFile);
const template = fileURLToPath(new URL('../..', import.meta.url));
const originalDatabaseEnvironment = { ...process.env };
before(() => Object.assign(process.env, localTestDatabaseEnvironment));
after(() => {
  for (const key of Object.keys(localTestDatabaseEnvironment)) {
    if (originalDatabaseEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalDatabaseEnvironment[key];
  }
});

interface Manifest {
  schemaVersion: number;
  id: string;
  version: string;
  pages: Array<{
    key: string;
    path: string;
    title: string;
    file: string;
    scope: { kind: string; profile: string };
    kind?: string;
    source?: { kind: string; url?: string; verifiedOn?: string; license?: string };
    links?: string[];
    notes?: Array<{ key: string; text: string; date?: string; author?: string }>;
    record?: { topicTags: string[]; observedOn: string; state: string; summary: string; applicability?: string };
  }>;
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-seed-'));
  const root = join(directory, 'template');
  const policyApprovalFile = join(directory, 'approved-policies.json');
  try {
    await mkdir(join(root, 'scripts'), { recursive: true });
    for (const entry of ['src', 'knowledge-datasets', 'package.json'])
      await cp(join(template, entry), join(root, entry), { recursive: true });
    await cp(join(template, 'scripts/seed-knowledge.ts'), join(root, 'scripts/seed-knowledge.ts'));
    await symlink(join(template, 'node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(policyApprovalFile, '{}');
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
  const database = join(directory, 'support.db');
  const url = pathToFileURL(database).href;
  const manifestFile = join(root, 'knowledge-datasets/retail-pos/manifest.json');
  const environment = {
    ...process.env,
    ...localTestDatabaseEnvironment,
    PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
    SUPPORT_DATABASE_URL: url,
    SUPPORT_POLICY_APPROVAL_FILE: policyApprovalFile,
  };
  async function cli(
    options: { dataset?: string | null; example?: string; args?: string[]; url?: string; code?: number } = {},
  ) {
    let stdout = '';
    let stderr = '';
    let code = 0;
    const dataset = options.dataset === null ? [] : ['--dataset', options.dataset ?? 'retail-pos'];
    try {
      const result = await execute('npm', ['run', 'knowledge:seed', '--', ...dataset, ...(options.args ?? [])], {
        cwd: root,
        env: { ...environment, SUPPORT_DATABASE_URL: options.url ?? url, SUPPORT_EXAMPLE: options.example },
        timeout: 30000,
        maxBuffer: 2_000_000,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      const failure = error as Error & { code: number; stdout: string; stderr: string };
      if (typeof failure.code !== 'number') throw error;
      ({ code, stdout, stderr } = failure);
    }
    const output = `${stdout}\n${stderr}`;
    assert.equal(code, options.code ?? 0, output);
    const report = code === 0 ? (JSON.parse(stdout.slice(stdout.indexOf('{'))) as SeedReport) : undefined;
    return { report: report!, output };
  }
  async function readManifest(): Promise<Manifest> {
    return JSON.parse(await readFile(manifestFile, 'utf8'));
  }
  async function saveManifest(manifest: Manifest) {
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    return readManifest();
  }
  async function knowledge<T>(
    callback: (knowledge: Knowledge, storage: KnowledgeStorage) => Promise<T>,
    databaseUrl = url,
  ) {
    const store = new LibSQLStore({ id: 'seed-proof', url: databaseUrl });
    try {
      const knowledge = createKnowledge(store);
      return await callback(knowledge, await knowledge.getStorage());
    } finally {
      await store.close();
    }
  }
  async function sql(query: string, parameters: (string | number | null)[] = [], path = database) {
    // Keep Node's SQLite library in another process from libSQL's native SQLite library.
    const script = `import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.env.PROOF_DATABASE);
      try {
        const query = process.env.PROOF_SQL;
        const result = query === 'SNAPSHOT'
          ? db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%' ORDER BY name").all().map(({ name }) => ({ name, rows: db.prepare('SELECT * FROM "' + name + '"').all().map(row => JSON.stringify(row)).sort() }))
          : db.prepare(query).all(...JSON.parse(process.env.PROOF_PARAMETERS));
        console.log(JSON.stringify(result));
      } finally { db.close(); }`;
    const result = await execute(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...environment, PROOF_DATABASE: path, PROOF_SQL: query, PROOF_PARAMETERS: JSON.stringify(parameters) },
      timeout: 10000,
      maxBuffer: 2_000_000,
    });
    return JSON.parse(result.stdout) as unknown[];
  }
  async function snapshot() {
    return sql('SNAPSHOT');
  }
  return {
    directory,
    root,
    database,
    url,
    manifestFile,
    cli,
    readManifest,
    saveManifest,
    knowledge,
    sql,
    snapshot,
    environment,
    async close() {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

test('startup retries an incomplete seed and preserves a later policy revision', async () => {
  const f = await fixture();
  try {
    const config = { ...datasets['retail-pos']!, directory: dirname(f.manifestFile) };
    const options = { databaseUrl: f.url };
    const missingManifest = { ...config, manifestFile: 'absent.json' };
    await assert.rejects(seedDatasetOnce(missingManifest, options), { code: 'ENOENT' });
    await seedDatasetOnce(config, options);
    const scope = 'tenant:north';
    const path = 'policies/safe-changes';
    const current = async () =>
      f.knowledge(async (_, storage) => {
        const [home] = await storage.getScopesByAddress([scope]);
        const policy = home && (await storage.getPageByPath({ scopeId: home.id, path: path.split('/'), read: 'all' }));
        assert.ok(policy?.body, 'First successful startup must publish the policy');
        return policy;
      });
    const original = await current();
    const body = original.body! + '\n\nReview approved by the local operations lead.\n';
    await approvePolicyRevision(f.environment.SUPPORT_POLICY_APPROVAL_FILE, `${scope}#${path}`, body);
    await f.knowledge(async knowledge => {
      await knowledge.upsertPage({ scope, path, name: original.name, body, author: 'operator' });
    });
    const revised = await current();
    assert.equal(revised.version, original.version + 1);
    await seedDatasetOnce(missingManifest, options);
    assert.deepEqual(await current(), revised);
    await f.sql('DELETE FROM support_seed_initializations');
    await seedDatasetOnce(config, options);
    assert.deepEqual(await current(), revised);
  } finally {
    await f.close();
  }
});

async function notes(storage: KnowledgeStorage, pageId: string) {
  const result = [];
  let cursor: string | undefined;
  do {
    const batch = await storage.listNotes({ pageId, read: 'all', cursor, limit: 100 });
    result.push(...batch.notes);
    cursor = batch.nextCursor;
  } while (cursor);
  return result;
}
function page(report: SeedReport, key: string) {
  const result = report.pages.find(item => item.key === key);
  assert.ok(result?.id, `Missing stored page ${key}`);
  return result;
}
async function noFile(path: string) {
  await assert.rejects(stat(path), { code: 'ENOENT' });
}
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

test('seed preserves a host page written before the guarded transaction begins', async t => {
  for (const scenario of ['create', 'update', 'move-parent-before-create', 'move-parent-before-update']) {
    await t.test(scenario, async t => {
      const f = await fixture();
      try {
        const seeded = (await f.cli()).report;
        const config = { ...datasets['retail-pos']!, directory: dirname(f.manifestFile) };
        const manifest = await f.readManifest();
        const guide = manifest.pages[0]!;
        const createsPage = scenario.endsWith('create');
        const movesParent = scenario.startsWith('move-parent');
        const destination = createsPage ? 'guides/concurrent-page' : guide.path;
        await f.saveManifest({
          ...manifest,
          pages: createsPage
            ? [{ ...guide, key: 'new-guide', path: destination }, ...manifest.pages]
            : [{ ...guide, title: 'Seed update' }, ...manifest.pages.slice(1)],
        });
        await f.knowledge(async (host, storage) => {
          const begin = KnowledgeLibSQL.prototype.transaction;
          let writtenId: string | undefined;
          const hook = t.mock.method(KnowledgeLibSQL.prototype, 'transaction', async function <
            T,
          >(this: KnowledgeLibSQL, operation: (storage: KnowledgeStorage) => Promise<T>) {
            if (!writtenId) {
              if (movesParent) {
                await host.movePage({ scope: 'docs:north', path: 'guides', toScope: 'docs:south' });
              }
              const { page } = await host.upsertPage({
                scope: 'docs:north',
                path: destination,
                name: 'Operator update',
                body: 'Keep the operator’s change.',
                author: 'operator',
              });
              writtenId = page.id;
            }
            return begin.call(this, operation) as Promise<T>;
          });
          try {
            await assert.rejects(seedDataset(config, { databaseUrl: f.url }), { name: 'KnowledgeConflictError' });
          } finally {
            hook.mock.restore();
          }
          assert.ok(writtenId);
          const current = await storage.getPage({ id: writtenId, read: 'all' });
          assert.equal(current?.name, 'Operator update');
          assert.equal(current.body, 'Keep the operator’s change.');
          assert.equal(current.updatedBy.author, 'operator');
          if (movesParent) {
            const moved = await storage.getPage({ id: page(seeded, 'connection-guide').id!, read: 'all' });
            assert.equal(moved?.name, guide.title);
            const [foreign] = await storage.getScopesByAddress(['docs:south']);
            const pageAtOldParent = await storage.getPageByPath({
              scopeId: foreign!.id,
              path: destination.split('/'),
              read: 'all',
            });
            assert.equal(pageAtOldParent?.id, createsPage ? undefined : moved?.id);
          }
        });
      } finally {
        await f.close();
      }
    });
  }
});

test('seed without retention reporting still resolves links and creates managed notes', async t => {
  const f = await fixture();
  try {
    await f.knowledge(async (knowledge, storage) => {
      const { page: host } = await knowledge.upsertPage({
        scope: 'docs:north',
        path: 'operator',
        name: 'Operator guide',
        body: 'See [[docs:north#guides/connectivity]].',
      });
      const links = () => storage.listPageLinks({ pageIds: [host.id], read: 'all', direction: 'out' });
      assert.deepEqual(await links(), []);
      const listPages = t.mock.method(KnowledgeLibSQL.prototype, 'listPages');
      const report = await seedDataset(
        { ...datasets['retail-pos']!, directory: dirname(f.manifestFile) },
        { databaseUrl: f.url, reportRetention: false },
      );
      assert.equal(listPages.mock.callCount(), 0);
      assert.equal(report.notes[0]?.status, 'created');
      assert.deepEqual(
        (await links()).map(edge => edge.toPageId),
        [page(report, 'connection-guide').id],
      );
    });
  } finally {
    await f.close();
  }
});

test('seed_rejects_an_invalid_rendered_policy_without_changing_stored_knowledge', { timeout: 120000 }, async () => {
  const f = await fixture();
  try {
    const initial = (await f.cli()).report;
    const before = await f.snapshot();
    const manifest = await f.readManifest();
    const originalTitle = manifest.pages[0]!.title;
    manifest.pages[0]!.title = 'Revised network checks';
    await f.saveManifest(manifest);

    const policyPath = join(dirname(f.manifestFile), 'policy.md');
    const complete = await readFile(policyPath, 'utf8');
    const instructions = 'Before a disruptive change, confirm authorization and preserve pending work. ';
    const oversized = `# Safe changes\n\n${instructions.repeat(10).trim()}`;
    assert.ok(oversized.length < 800, 'The source fits before seed attribution and links are added');
    const recordOnly = '```support-record\n' + JSON.stringify(manifest.pages[2]!.record) + '\n```';

    for (const [body, reason] of [
      [oversized, /exceeds the 800-character limit/u],
      ['This page contains no policy. The safety procedure is not yet available.', /substantive policy instructions/u],
      [
        ['Before changes', 'Prohibited actions', 'When uncertain']
          .map(name => `## ${name}\n\nPolicy pending review.`)
          .join('\n\n'),
        /revision .* is not approved/u,
      ],
      [
        complete.replace(/(## Prohibited actions\n\n)[^\n]+/u, '$1[[connection-guide]]'),
        /substantive policy instructions under the Prohibited actions heading/u,
      ],
      [
        complete.replace(
          /(## Before changes\n\n)[^\n]+/u,
          '$1### Prepare verified recovery copies\n\n## Other guidance\n\nCreate verified recovery copies.',
        ),
        /substantive policy instructions under the Before changes heading/u,
      ],
      ...['Source:', '**Source:**'].map(
        label =>
          [
            complete.replace(/(## Prohibited actions\n\n)[^\n]+/u, `$1${label} North Branch Operations`),
            /substantive policy instructions under the Prohibited actions heading/u,
          ] as const,
      ),
      [
        complete.replace('## Prohibited actions', '[[connection-guide]]## Prohibited actions'),
        /substantive policy instructions under the Prohibited actions heading/u,
      ],
      ['# Safe changes\n\n[[connection-guide]]', /substantive policy instructions/u],
      [
        '# Safe changes\n\n> Source: Archived product documentation from the regional equipment maintenance library.',
        /substantive policy instructions/u,
      ],
      [`# Safe changes\n\n${recordOnly}`, /substantive policy instructions/u],
      [
        '# Safe changes\n\n[Reference catalog vendor handbook product documentation](https://example.com/manual)',
        /substantive policy instructions/u,
      ],
      [
        'https://reference-catalog-vendor.example.com/handbook/product/documentation',
        /substantive policy instructions/u,
      ],
      ['reference.catalog.vendor.handbook.product.documentation@example.com', /substantive policy instructions/u],
    ] as const) {
      await writeFile(policyPath, body);
      for (const args of [['--dry-run'], []]) {
        const { output } = await f.cli({ args, code: 1 });
        assert.match(output, /policy\.md/u);
        assert.match(output, /tenant:north#policies\/safe-changes/u);
        assert.match(output, reason);
        assert.deepEqual(await f.snapshot(), before, 'The active policy version and other Knowledge must be preserved');
      }
    }
    const updated = complete.replace(/(## Before changes\n\n)[^\n]+/u, `$1> **${instructions.trim()}**`);
    const stored = await f.knowledge((_, store) =>
      store.getPage({ id: page(initial, 'safety-policy').id!, read: 'all' }),
    );
    const renderAliases = (text: string) =>
      text.trimEnd().replace('[[connection-guide]]', '[[docs:north#guides/connectivity]]');
    assert.ok(stored?.body?.includes(renderAliases(complete)));
    await approvePolicyRevision(
      f.environment.SUPPORT_POLICY_APPROVAL_FILE,
      'tenant:north#policies/safe-changes',
      stored!.body!.replace(renderAliases(complete), renderAliases(updated)),
    );
    await writeFile(policyPath, updated);
    await f.cli({ args: ['--dry-run'] });
    assert.equal(page((await f.cli()).report, 'safety-policy').status, 'updated');
    assert.equal(page((await f.cli()).report, 'safety-policy').status, 'unchanged');

    await writeFile(policyPath, complete);
    manifest.pages[0]!.title = originalTitle;
    await f.saveManifest(manifest);
    await f.cli({ args: ['--dry-run'] });
    assert.equal(page((await f.cli()).report, 'safety-policy').status, 'updated');
    const restored = await f.knowledge((_, store) =>
      store.getPage({ id: page(initial, 'safety-policy').id!, read: 'all' }),
    );
    assert.equal(restored?.name, stored?.name);
    assert.equal(restored?.body, stored?.body);
  } finally {
    await f.close();
  }
});

test('seed requires the configured policy reference when a mapping omits its override', async () => {
  const f = await fixture();
  try {
    const original = (await f.cli()).report;
    const policy = await f.knowledge((_, storage) =>
      storage.getPage({ id: page(original, 'safety-policy').id!, read: 'all' }),
    );
    assert.ok(policy?.body);
    const config = {
      ...datasets['retail-pos']!,
      directory: dirname(f.manifestFile),
      mandatoryPolicies: [{ profileId: 'north-store', pageKey: 'safety-policy' }],
    };
    const options = { dryRun: true, policyApprovalFile: f.environment.SUPPORT_POLICY_APPROVAL_FILE };
    await seedDataset(config, options);
    const manifest = await f.readManifest();
    manifest.pages[1]!.path = 'policies/alternate';
    await f.saveManifest(manifest);
    const ref = 'tenant:north#policies/alternate';
    await approvePolicyRevision(options.policyApprovalFile, ref, policy.body);
    await assert.rejects(seedDataset(config, options), /Invalid mandatory policy mapping/u);
    const explicit = await seedDataset(
      { ...config, mandatoryPolicies: [{ ...config.mandatoryPolicies[0]!, ref }] },
      options,
    );
    assert.equal(explicit.pages.find(page => page.key === 'safety-policy')?.destination, ref);
  } finally {
    await f.close();
  }
});

test('seed reports a managed note retained on its merge destination', async () => {
  const f = await fixture();
  try {
    const manifest = await f.readManifest();
    manifest.pages.push({ ...manifest.pages[2]!, key: 'another-case', path: 'cases/another', notes: [] });
    await f.saveManifest(manifest);
    const initial = (await f.cli()).report;
    const source = page(initial, 'store-case');
    const target = page(initial, 'another-case');
    const oldNoteId = initial.notes[0]!.id!;
    const retainedIds = [oldNoteId];
    await f.knowledge(async (knowledge, storage) => {
      await storage.mergePages({
        sourceId: source.id!,
        sourceVersion: source.version!,
        targetId: target.id!,
        provenance: { author: 'synthetic-operator' },
      });
      assert.equal((await storage.getNote({ id: oldNoteId, read: 'all' }))?.pageId, target.id);
      const add = (text: string, author: string) =>
        knowledge.addNote({ scope: 'customer:north:store-1', path: 'cases/another', text, author });
      for (let index = 0; index < 101; index++) {
        const note = await add(`Seed note: retail-pos/another-case/old-${index}\nRetained example.`, 'seed:retail-pos');
        retainedIds.push(note.id);
      }
      await add('Seed note: retail-pos/another-case/unowned', 'synthetic-operator');
      await add('Seed note: retail-pos-other/another-case/foreign', 'seed:retail-pos');
      await add('seed note: retail-pos/another-case/wrong-case', 'seed:retail-pos');
      const deleted = await add('Seed note: retail-pos/another-case/deleted', 'seed:retail-pos');
      await knowledge.removeNote({ id: deleted.id });
    });
    const repeated = (await f.cli()).report;
    const newNote = repeated.notes.find(note => note.pageKey === 'store-case');
    assert.ok(newNote?.id && newNote.id !== oldNoteId);
    assert.deepEqual(repeated.retained.sort(), retainedIds.map(id => `note:${id}`).sort());
    await f.knowledge(async (_, storage) => {
      assert.equal((await storage.getNote({ id: newNote.id!, read: 'all' }))?.pageId, page(repeated, 'store-case').id);
    });
  } finally {
    await f.close();
  }
});

test('seed caps raw Markdown bytes and validates the normalized character count', async () => {
  const f = await fixture();
  try {
    const file = join(dirname(f.manifestFile), 'connectivity.md');
    await writeFile(file, `${'界'.repeat(999_000)}\r\n`);
    await f.cli({ args: ['--dry-run'] });
    await writeFile(file, 'x'.repeat(1_000_001));
    assert.match((await f.cli({ args: ['--dry-run'], code: 1 })).output, /Invalid Markdown body/u);
    await writeFile(file, `Valid Markdown followed by oversized trailing whitespace.\n${' '.repeat(4_000_000)}`);
    assert.match(
      (await f.cli({ args: ['--dry-run'], code: 1 })).output,
      /Markdown file connectivity\.md exceeds the 4000000-byte read bound/u,
    );
    await noFile(f.database);
  } finally {
    await f.close();
  }
});

test('seed rejects a long run of unclosed wiki links before opening a store', async () => {
  const f = await fixture();
  try {
    const manifest = await f.readManifest();
    await writeFile(join(dirname(f.manifestFile), manifest.pages[0]!.file), '[[missing\n'.repeat(30_000));
    const result = await f.cli({ args: ['--dry-run'], code: 1 });
    assert.match(result.output, /(?:Malformed|Ambiguous) wiki link/u);
    await noFile(f.database);
  } finally {
    await f.close();
  }
});

test('seed bounds repeated wiki-link expansion per docs page and across the dataset', async () => {
  const f = await fixture();
  try {
    const manifest = await f.readManifest();
    const guide = manifest.pages[0]!;
    const target = {
      key: 'r',
      path: ['guides', ...Array.from({ length: 5 }, () => 'long'.repeat(18))].join('/'),
      title: 'Reference target for expanded links',
      file: 'expansion-target.md',
      scope: guide.scope,
    };
    manifest.pages.push(target);
    await f.saveManifest(manifest);
    const directory = dirname(f.manifestFile);
    await writeFile(join(directory, target.file), 'A guide with a long canonical path.');
    const file = join(directory, guide.file);
    const linkLength = `[[docs:north#${target.path}]]\n`.length;
    await writeFile(file, '[[r]]\n'.repeat(Math.ceil(1_010_000 / linkLength)));
    assert.match(
      (await f.cli({ args: ['--dry-run'], code: 1 })).output,
      /Rendered page body in connectivity\.md exceeds the 1000000-character read bound/u,
    );

    await writeFile(file, '[[r]]\n'.repeat(Math.floor(990_000 / linkLength)));
    await f.cli({ args: ['--dry-run'] });
    manifest.pages.push(
      ...Array.from({ length: 33 }, (_, i) => ({
        ...guide,
        key: `expanded-${i}`,
        path: `guides/expanded-${i}`,
      })),
    );
    await f.saveManifest(manifest);
    assert.match(
      (await f.cli({ code: 1 })).output,
      /Rendered dataset retail-pos exceeds the 32000000-character output bound/u,
    );
    await noFile(f.database);
  } finally {
    await f.close();
  }
});

test('seed rejects oversized manifests before JSON parsing and enforces the page count separately', async () => {
  const f = await fixture();
  try {
    const original = await f.readManifest();
    await writeFile(f.manifestFile, JSON.stringify(original) + ' '.repeat(16 * 1024 * 1024));
    assert.match(
      (await f.cli({ args: ['--dry-run'], code: 1 })).output,
      /Manifest manifest\.json exceeds the 16777216-byte read bound/u,
    );
    await f.saveManifest({ ...original, pages: Array.from({ length: 501 }, () => original.pages[0]!) });
    assert.match((await f.cli({ args: ['--dry-run'], code: 1 })).output, /Invalid pages/u);
    await noFile(f.database);
  } finally {
    await f.close();
  }
});

test('seed keeps literal Markdown destination-like text and validates actual links and images', async () => {
  const f = await fixture();
  try {
    const manifest = await f.readManifest();
    const guideFile = join(dirname(f.manifestFile), manifest.pages[0]!.file);
    const prose = 'The log displays ](panel). [Valid link](https://example.invalid/panel) and ![Image](#diagram).';
    const literal = '```text\n<?example\n```';
    await writeFile(guideFile, `${prose}\n\n<?example`);
    assert.match((await f.cli({ args: ['--dry-run'], code: 1 })).output, /Unsupported or reserved Markdown syntax/u);
    const canonical = manifest.pages[0]!.source!.url;
    manifest.pages[0]!.source!.url = 'https:example.org';
    await f.saveManifest(manifest);
    await writeFile(guideFile, literal);
    assert.match((await f.cli({ args: ['--dry-run'], code: 1 })).output, /Unsafe source URL/u);
    manifest.pages[0]!.source!.url = canonical;
    await f.saveManifest(manifest);
    await writeFile(guideFile, `${prose}\n\n${literal}`);
    const report = (await f.cli()).report;
    const guide = page(report, 'connection-guide');
    await f.knowledge(async (_, storage) => {
      const stored = await storage.getPage({ id: guide.id!, read: 'all' });
      assert.ok(stored?.body?.includes(prose));
      assert.ok(stored?.body?.includes(literal));
      assert.ok(stored?.body?.includes(`(${canonical})`));
      assert.ok(stored?.body?.includes('<!-- knowledge-seed:source:https -->'));
    });
    for (const markdown of ['[Actual link](panel)', '![Actual image](panel)']) {
      await writeFile(guideFile, markdown);
      assert.match((await f.cli({ args: ['--dry-run'], code: 1 })).output, /Invalid source URL/u);
    }
  } finally {
    await f.close();
  }
});

test('unchanged seed pages clear stale unresolved body-link rows', async () => {
  const f = await fixture();
  try {
    const manifest = await f.readManifest();
    const guideInput = manifest.pages[0]!;
    const seeded = (await f.cli()).report;
    const guide = page(seeded, 'connection-guide');
    guideInput.links = [];
    await f.saveManifest(manifest);
    await writeFile(join(dirname(f.manifestFile), guideInput.file), 'The guide has no outgoing links.');
    const removed = (await f.cli()).report;
    assert.equal(page(removed, 'connection-guide').status, 'updated');

    const staleRef = 'missing-previous-page';
    await f.knowledge(async (_, storage) => {
      await storage.replacePageBodyLinks({
        pageId: guide.id!,
        links: [{ ref: staleRef, toPageId: null, count: 1 }],
      });
    });
    const repaired = (await f.cli()).report;
    assert.equal(page(repaired, 'connection-guide').status, 'unchanged');
    assert.equal(repaired.repairedLinks, true);
    await f.knowledge(async (_, storage) => {
      assert.deepEqual(await storage.listPageBodyLinkSources({ refs: [staleRef] }), []);
    });
    assert.equal((await f.cli()).report.repairedLinks, false);
  } finally {
    await f.close();
  }
});

test('seed checks the rendered body of customer references on every path', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    await f.cli();
    const before = await f.snapshot();
    const manifest = await f.readManifest();
    const reference = manifest.pages[2]!;
    reference.kind = 'reference';
    delete reference.record;
    await f.saveManifest(manifest);
    await writeFile(join(dirname(f.manifestFile), reference.file), 'x'.repeat(1_000_000));
    for (const args of [['--dry-run'], []]) {
      const { output } = await f.cli({ args, code: 1 });
      assert.match(output, /Rendered page body in case\.md exceeds the 1000000-character read bound/u);
      assert.deepEqual(await f.snapshot(), before);
    }
    reference.path = 'manual/reference';
    await f.saveManifest(manifest);
    assert.match(
      (await f.cli({ args: ['--dry-run'], code: 1 })).output,
      /Rendered page body in case\.md exceeds the 1000000-character read bound/u,
    );
  } finally {
    await f.close();
  }
});

test('seed preserves wiki syntax in code alongside managed prose links', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    const manifest = await f.readManifest();
    manifest.pages[2]!.links = [];
    await f.saveManifest(manifest);
    const caseFile = join(dirname(f.manifestFile), manifest.pages[2]!.file);
    const code = [
      '    [[docs:north#guides/connectivity]] [[indented-placeholder]]',
      '',
      '`[[example-placeholder]]`',
      '',
      '```text',
      '[[connection-guide]] [[example-placeholder]]',
      '```',
      '',
      '~~~text',
      '[[example-placeholder]]',
      '~~~',
      '',
      '> ~~~text',
      '> [[docs:north#guides/connectivity]] [[quoted-placeholder]]',
      '> ~~~',
      '',
      '````markdown',
      '```support-record',
      '{"example": true}',
      '```',
      '````',
    ].join('\n');
    const inlineUrl = '[Guide](https://example.com/search?filter=[[connection-guide]])';
    const literalRefUrl = '[Guide](https://example.com/search?filter=[[docs:north#guides/connectivity]])';
    const bareUrl = 'https://example.com/search?filter=[[connection-guide]]&view=compact';
    const noteExample = '`[[example-placeholder]] [[connection-guide]]`';
    manifest.pages[2]!.notes![0]!.text = `${noteExample} ${literalRefUrl} See [[connection-guide]].`;
    await f.saveManifest(manifest);
    await writeFile(
      caseFile,
      `${code}\n\n${inlineUrl}\n\n${literalRefUrl}\n\n${bareUrl}\n\nSee [[connection-guide]].\n`,
    );
    await f.cli({ args: ['--dry-run'] });
    const report = (await f.cli()).report;
    const casePage = page(report, 'store-case');
    const guide = page(report, 'connection-guide');
    assert.ok(casePage.id);
    const caseId = casePage.id;
    const stored = await f.knowledge(async (_, store) => {
      const edges = await store.listPageLinks({
        pageIds: [caseId],
        read: 'all',
        direction: 'out',
        kinds: ['body'],
      });
      assert.deepEqual(
        edges.map(edge => [edge.toPageId, edge.count]),
        [[guide.id, 1]],
      );
      const [note] = await notes(store, caseId);
      assert.ok(note?.text.includes(`${noteExample} ${literalRefUrl} See [[${guide.destination}]].`));
      assert.deepEqual(note.mentions, [guide.id]);
      return store.getPage({ id: caseId, read: 'all' });
    });
    assert.ok(stored?.body?.includes(code));
    assert.ok(stored?.body?.includes(inlineUrl));
    assert.ok(stored?.body?.includes(literalRefUrl));
    assert.ok(stored?.body?.includes(bareUrl));
    assert.ok(stored?.body?.includes(`See [[${guide.destination}]].`));
    assert.equal((await f.cli()).report.repairedLinks, false, 'A repeated seed preserves the corrected link index');

    await f.knowledge(async (knowledge, storage) => {
      const prose = `See [[${guide.destination}]].`;
      const body = ['  ~~~text', `[[${guide.destination}]]`, '  ~~~', '', prose].join('\n');
      const { page } = await knowledge.upsertPage({
        scope: 'docs:north',
        path: 'reindex-example',
        name: 'Reindex example',
        body,
      });
      await knowledge.reindexLinks();
      const edges = await storage.listPageLinks({ pageIds: [page.id], read: 'all', direction: 'out', kinds: ['body'] });
      assert.deepEqual(
        edges.map(edge => [edge.toPageId, edge.count]),
        [[guide.id, 1]],
      );
      assert.equal((await storage.getPage({ id: page.id, read: 'all' }))?.body, body);
    });

    const stable = await f.snapshot();
    await writeFile(caseFile, '# Example\n\n~~~text\n[[example-placeholder]]');
    assert.match((await f.cli({ code: 1 })).output, /Unclosed Markdown code block before generated page content/u);
    assert.deepEqual(await f.snapshot(), stable);
  } finally {
    await f.close();
  }
});

test('seed_dry_run_apply_repeat_and_update_preserve_provenance', { timeout: 120000 }, async () => {
  const f = await fixture();
  try {
    const initial = await f.cli({ dataset: null, args: ['--dry-run'] });
    assert.equal(initial.report.dataset, 'retail-pos-docs');
    assert.ok(initial.report.pages.some(item => item.destination === 'docs:retailops#guides/network'));
    assert.ok(initial.report.pages.every(item => !item.destination.startsWith('customer:')));
    const alternateInitial = await f.cli({ dataset: null, example: 'software-integration', args: ['--dry-run'] });
    assert.equal(alternateInitial.report.dataset, 'software-integration');
    assert.ok(alternateInitial.report.pages.some(item => item.destination === 'docs:software#guides/request-check'));
    await noFile(f.database);

    const manifest = await f.readManifest();
    assert.deepEqual(
      manifest.pages.map(item => item.key),
      ['connection-guide', 'safety-policy', 'store-case'],
    );
    assert.match(
      await readFile(join(f.root, 'knowledge-datasets/retail-pos', manifest.pages[0]!.file), 'utf8'),
      /Square Terminal network checks/u,
    );
    manifest.pages[0]!.source!.url = 'https://example.com/synthetic-reference';
    manifest.pages[0]!.source!.verifiedOn = '2026-01-15';
    manifest.pages[0]!.source!.license = 'Apache-2.0';
    const supportedLinks =
      '[Reference](https://example.com/reference?first=1&second=2)\n\n![Indicator](https://example.com/indicator%28part%29.png?first=1&second=2)\n\n[Section](#example-connectivity-checks)\n\nhttps://example.com/path@fixture?first=1&second=2\n\n[Contact](https://example.com?contact=fixture@example.com)\n\nwww.example.com/path@fixture?first=1&second=2';
    const supportedNoteLinks =
      '[Reference](https://example.com?first=1&second=2)\n![Indicator](https://example.com/image.png)\nhttp://example.com/path@fixture\nwww.example.com/path@fixture';
    manifest.pages[2]!.notes![0]!.text += `\n${supportedNoteLinks}`;
    const supportedBodyPath = join(f.root, 'knowledge-datasets/retail-pos', manifest.pages[0]!.file);
    await writeFile(
      supportedBodyPath,
      `${await readFile(supportedBodyPath, 'utf8')}\n${supportedLinks}\n\n[[connection-guide]]\n[[safety-policy]]\n`,
    );
    assert.ok((await readFile(supportedBodyPath, 'utf8')).includes(supportedLinks));
    const casePath = join(f.root, 'knowledge-datasets/retail-pos', manifest.pages[2]!.file);
    const caseEntry = manifest.pages[2]!;
    const caseRecord = caseEntry.record!;
    caseRecord.summary += ' See [[connection-guide]].';
    const envelope = '```support-record\n' + JSON.stringify(caseRecord) + '\n```';
    delete caseEntry.links;
    delete manifest.pages[2]!.record;
    await writeFile(
      casePath,
      `${(await readFile(casePath, 'utf8')).trim()}\n\n${envelope}\n\n    Example transcript.\n`.replaceAll(
        '\n',
        '\r\n',
      ),
    );
    const loadedManifest = await f.saveManifest(manifest);
    const preview = (await f.cli({ args: ['--dry-run'] })).report;
    assert.equal(preview.dryRun, true);
    assert.deepEqual(
      preview.pages.map(item => item.destination),
      [
        'docs:north#guides/connectivity',
        'tenant:north#policies/safe-changes',
        'customer:north:store-1#cases/connection-check',
      ],
    );
    await noFile(f.database);
    await noFile(`${f.database}.writer.sqlite`);
    await f.sql('SELECT 1');
    await f.cli({ args: ['--dry-run'] });
    assert.deepEqual(await f.sql("SELECT name FROM sqlite_master WHERE type = 'table'"), []);

    const first = (await f.cli()).report;
    assert.ok(first.pages.every(item => item.status === 'created' && item.version === 1));
    assert.equal(first.notes[0]!.status, 'created');
    assert.equal(first.repairedLinks, false);
    const guide = page(first, 'connection-guide');
    const policy = page(first, 'safety-policy');
    const history = page(first, 'store-case');
    const initialNoteId = first.notes[0]!.id!;
    const unrelated = await f.knowledge(async (knowledge, storage) => {
      const owner = await knowledge.readScopeFor(principals(exampleProfiles[0]!));
      const otherCustomer = await knowledge.readScopeFor(principals(exampleProfiles[1]!));
      const foreignTenant = await knowledge.readScopeFor(principals(exampleProfiles[2]!));
      for (const item of first.pages) {
        const stored = await storage.getPage({ id: item.id!, read: owner });
        assert.ok(stored);
        assert.equal(stored.createdBy.author, 'seed:retail-pos');
        assert.equal(stored.updatedBy.author, 'seed:retail-pos');
        const parent = await storage.getPage({ id: stored.parentId!, read: owner });
        assert.equal(
          parent?.key,
          item.key === 'connection-guide' ? 'guides' : item.key === 'safety-policy' ? 'policies' : 'cases',
        );
        assert.equal(parent?.scopeId, stored.scopeId);
        assert.equal(await storage.getPage({ id: stored.id, read: foreignTenant }), null);
      }
      assert.ok(await storage.getPage({ id: guide.id!, read: otherCustomer }));
      assert.ok(await storage.getPage({ id: policy.id!, read: otherCustomer }));
      assert.equal(await storage.getPage({ id: history.id!, read: otherCustomer }), null);
      const storedGuide = await storage.getPage({ id: guide.id!, read: owner });
      assert.ok(storedGuide?.body?.includes(loadedManifest.pages[0]!.source!.url!));
      assert.ok(storedGuide?.body?.includes(supportedLinks));
      assert.match(
        storedGuide!.body!,
        /\[\[docs:north#guides\/connectivity\]\]\n\[\[tenant:north#policies\/safe-changes\]\]/u,
      );
      assert.match(storedGuide!.body!, /verified 2026-01-15; license: Apache-2.0/u);
      const linked = await storage.listPageLinks({
        pageIds: [guide.id!, policy.id!],
        read: owner,
        kinds: ['body'],
        direction: 'out',
      });
      assert.deepEqual(
        linked.map(edge => [edge.fromPageId, edge.toPageId]).sort(),
        [
          [guide.id!, policy.id!],
          [policy.id!, guide.id!],
        ].sort(),
      );
      const note = await storage.getNote({ id: initialNoteId, read: owner });
      assert.ok(note);
      assert.equal(note.text.split('\n')[0], 'Seed note: retail-pos/store-case/follow-up');
      assert.match(note.text, /Fixture author: Example technician/u);
      assert.ok(note.text.includes(supportedNoteLinks));
      assert.equal(note.when?.toISOString(), '2026-01-13T00:00:00.000Z');
      assert.equal(note.provenance.author, 'seed:retail-pos');
      assert.deepEqual(note.stampScopeIds, [(await storage.getPage({ id: history.id!, read: owner }))!.scopeId]);
      assert.deepEqual(note.mentions, [guide.id!]);
      assert.equal(await storage.getNote({ id: note.id, read: otherCustomer }), null);
      const record = (await storage.getPage({ id: history.id!, read: owner }))!.body!;
      assert.match(record, /```support-record\n/u);
      assert.match(record, /"state":\s*"approved"/u);
      assert.ok(record.includes('[[docs:north#guides/connectivity]]'));
      assert.deepEqual(
        await storage.listPageLinks({ pageIds: [history.id!], read: owner, kinds: ['body'], direction: 'out' }),
        [],
        'A wiki reference only inside the support-record fence does not create a body edge',
      );
      assert.match(record, /\n\n {4}Example transcript\./u);
      return knowledge.addNote({
        scope: 'customer:north:store-1',
        path: 'cases/connection-check',
        text: 'Unrelated technician observation.',
        author: 'technician:lee',
      });
    });
    const stable = await f.snapshot();
    const repeated = (await f.cli()).report;
    assert.ok(repeated.pages.every(item => item.status === 'unchanged'));
    assert.deepEqual(
      repeated.pages.map(item => [item.id, item.version]),
      first.pages.map(item => [item.id, item.version]),
    );
    assert.equal(repeated.notes[0]!.id, initialNoteId);
    assert.deepEqual(await f.snapshot(), stable);

    const guideFile = join(f.root, 'knowledge-datasets/retail-pos', loadedManifest.pages[0]!.file);
    await writeFile(
      guideFile,
      `${await readFile(guideFile, 'utf8')}\nRecord the example indicator before the next check.\n`,
    );
    assert.match(await readFile(guideFile, 'utf8'), /before the next check/u);
    loadedManifest.pages[2]!.notes![0]!.text = 'Revised fictional follow-up. See [[connection-guide]].';
    loadedManifest.pages[2]!.notes![0]!.date = '2026-01-16';
    loadedManifest.pages[2]!.notes![0]!.author = 'Example reviewer';
    const revisedFixture = await f.saveManifest(loadedManifest);
    const changed = (await f.cli()).report;
    assert.deepEqual(
      changed.pages.filter(item => item.status === 'updated').map(item => item.key),
      ['connection-guide'],
    );
    assert.equal(page(changed, 'connection-guide').id, guide.id);
    assert.equal(page(changed, 'connection-guide').version, guide.version! + 1);
    assert.equal(changed.notes[0]!.status, 'updated');
    assert.notEqual(changed.notes[0]!.id, initialNoteId);
    await f.knowledge(async (_, storage) => {
      const current = await notes(storage, history.id!);
      assert.equal(current.length, 2);
      const managed = current.find(item => item.id === changed.notes[0]!.id)!;
      assert.ok(
        managed.text.includes(
          revisedFixture.pages[2]!.notes![0]!.text.replace(
            '[[connection-guide]]',
            '[[docs:north#guides/connectivity]]',
          ),
        ),
      );
      assert.equal(managed.when?.toISOString().slice(0, 10), revisedFixture.pages[2]!.notes![0]!.date);
      assert.match(managed.text, /Fixture author: Example reviewer/u);
      assert.deepEqual(
        current.find(item => item.id === unrelated.id),
        unrelated,
      );
    });
    const updatedStable = await f.snapshot();
    await f.cli();
    assert.deepEqual(await f.snapshot(), updatedStable);

    delete revisedFixture.pages[2]!.notes![0]!.date;
    await f.saveManifest(revisedFixture);
    const cleared = (await f.cli()).report;
    await f.knowledge(async (_, storage) => {
      const current = await notes(storage, history.id!);
      assert.equal(current.length, 2);
      assert.equal(current.find(item => item.id === cleared.notes[0]!.id)!.when, undefined);
      assert.deepEqual(
        current.find(item => item.id === unrelated.id),
        unrelated,
      );
    });
    const currentNoteId = cleared.notes[0]!.id!;
    revisedFixture.pages[2]!.notes = [];
    await f.saveManifest(revisedFixture);
    const removedNote = (await f.cli()).report;
    assert.ok(removedNote.retained.includes(`note:${currentNoteId}`));
    revisedFixture.pages = revisedFixture.pages.filter(item => item.key !== 'store-case');
    await f.saveManifest(revisedFixture);
    const removedPage = (await f.cli()).report;
    assert.ok(removedPage.retained.includes(`page:${history.id}`));
    assert.ok(removedPage.retained.includes(`note:${currentNoteId}`));
    await f.knowledge(async (_, storage) => {
      assert.ok(await storage.getPage({ id: history.id!, read: 'all' }));
      assert.equal((await notes(storage, history.id!)).length, 2);
    });

    // Real missing index rows simulate a committed page whose secondary link write was interrupted.
    await f.knowledge(async (_, storage) => {
      await storage.replacePageBodyLinks({ pageId: guide.id!, links: [] });
    });
    const repaired = (await f.cli()).report;
    assert.equal(repaired.repairedLinks, true);
    assert.ok(repaired.pages.every(item => item.status === 'unchanged'));
    await f.knowledge(async (_, storage) => {
      const edges = await storage.listPageLinks({
        pageIds: [guide.id!],
        read: 'all',
        direction: 'out',
        kinds: ['body'],
      });
      assert.deepEqual(
        edges.map(edge => [edge.fromPageId, edge.toPageId]),
        [[guide.id!, policy.id!]],
      );
    });
    assert.equal((await f.cli()).report.repairedLinks, false);
    const alternateManifest = JSON.parse(
      await readFile(join(f.root, 'knowledge-datasets/software-integration/manifest.json'), 'utf8'),
    ) as Manifest;
    assert.equal(alternateManifest.id, 'software-integration');
    const alternate = (await f.cli({ dataset: alternateManifest.id })).report;
    assert.deepEqual(
      alternate.pages.map(item => item.destination),
      [
        'docs:software#guides/request-check',
        'tenant:software#policies/safe-changes',
        'customer:software:example-app#cases/request-check',
      ],
    );
    assert.ok(alternate.pages.every(item => item.status === 'created'));
    await f.knowledge(async (knowledge, storage) => {
      const retail = await knowledge.readScopeFor(principals(exampleProfiles[0]!));
      const integration = await knowledge.readScopeFor(['tenant:software', 'customer:software:example-app']);
      for (const item of alternate.pages) {
        assert.ok(await storage.getPage({ id: item.id!, read: integration }));
        assert.equal(await storage.getPage({ id: item.id!, read: retail }), null);
      }
      assert.ok(await storage.getPage({ id: history.id!, read: retail }));
    });
    const alternateStable = await f.snapshot();
    await f.cli({ dataset: alternateManifest.id });
    assert.deepEqual(await f.snapshot(), alternateStable);
  } finally {
    await f.close();
  }
});

test('seed_rejects_invalid_input_and_recovers_partial_note_update', { timeout: 120000 }, async () => {
  const f = await fixture();
  try {
    const original = await f.readManifest();
    const bodyPath = join(f.root, 'knowledge-datasets/retail-pos/connectivity.md');
    const originalBody = await readFile(bodyPath, 'utf8');
    const outside = join(f.root, 'knowledge-datasets/outside.md');
    await writeFile(outside, '# Outside dataset\n');
    await symlink(outside, join(f.root, 'knowledge-datasets/retail-pos/escape.md'));
    const first = (await f.cli()).report;
    const guide = page(first, 'connection-guide');
    const history = page(first, 'store-case');
    const invalid: Array<[string, (manifest: Manifest) => void, RegExp]> = [
      [
        'schema version',
        manifest => {
          manifest.schemaVersion = 2;
        },
        /Incompatible dataset manifest/u,
      ],
      [
        'duplicate alias',
        manifest => {
          manifest.pages[1]!.key = manifest.pages[0]!.key;
        },
        /Duplicate page key/u,
      ],
      [
        'canonical collision',
        manifest => {
          manifest.pages.push({ ...manifest.pages[0]!, key: 'duplicate-destination' });
        },
        /Duplicate or ambiguous canonical destination/u,
      ],
      [
        'unsafe destination',
        manifest => {
          manifest.pages[2]!.path = '../escape';
        },
        /Expected a normalized path key/u,
      ],
      [
        'missing file',
        manifest => {
          manifest.pages[2]!.file = 'missing.md';
        },
        /ENOENT.*missing\.md/u,
      ],
      [
        'relative path escape',
        manifest => {
          manifest.pages[2]!.file = '../outside.md';
        },
        /Expected a relative Markdown file/u,
      ],
      [
        'absolute path',
        manifest => {
          manifest.pages[2]!.file = outside;
        },
        /Expected a relative Markdown file/u,
      ],
      [
        'symlink escape',
        manifest => {
          manifest.pages[2]!.file = 'escape.md';
        },
        /Markdown file escapes the dataset/u,
      ],
      [
        'unknown alias',
        manifest => {
          manifest.pages[2]!.links = ['missing-alias'];
        },
        /Unknown link alias or unmanaged reference: missing-alias/u,
      ],
      [
        'shared to private canonical reference',
        manifest => {
          manifest.pages[0]!.notes = [
            { key: 'unsafe', text: 'Private [[customer:north:store-1#cases/connection-check]]' },
          ];
        },
        /Link crosses its audience: customer:north:store-1#cases\/connection-check/u,
      ],
      [
        'unmanaged native reference',
        manifest => {
          manifest.pages[2]!.notes![0]!.text = 'Unknown [[customer:north:store-1#unmanaged]]';
        },
        /Unknown link alias or unmanaged reference: customer:north:store-1#unmanaged/u,
      ],
      [
        'wrong customer reference',
        manifest => {
          manifest.pages.push({
            ...manifest.pages[2]!,
            key: 'other-case',
            scope: { kind: 'customer', profile: 'north-other' },
            notes: [],
          });
          manifest.pages[2]!.links = ['other-case'];
        },
        /Link crosses its audience: other-case/u,
      ],
      [
        'unsafe source URL',
        manifest => {
          manifest.pages[2]!.source = { kind: 'fixture', url: 'javascript:alert(1)' };
        },
        /Unsafe source URL/u,
      ],
      [
        'credential-bearing source URL',
        manifest => {
          manifest.pages[2]!.source = { kind: 'fixture', url: 'https://secret:password@example.com/source' };
        },
        /Unsafe source URL/u,
      ],
      [
        'array placement kind',
        manifest => {
          Object.assign(manifest.pages[0]!.scope, { kind: ['docs'] });
        },
        /Unregistered placement kind/u,
      ],
      [
        'array page kind',
        manifest => {
          Object.assign(manifest.pages[0]!, { kind: ['reference'] });
        },
        /Invalid page kind/u,
      ],
      [
        'record summary too long after link expansion',
        manifest => {
          manifest.pages[2]!.record!.summary = 'x'.repeat(975) + ' [[connection-guide]]';
        },
        /Invalid record summary/u,
      ],
      [
        'invalid mandatory policy kind',
        manifest => {
          manifest.pages[1]!.kind = 'reference';
        },
        /Invalid mandatory policy mapping/u,
      ],
      [
        'foreign mandatory policy',
        manifest => {
          manifest.pages[1]!.scope.profile = 'south-store';
        },
        /Invalid mandatory policy mapping/u,
      ],
      [
        'invalid record',
        manifest => {
          manifest.pages[2]!.record!.observedOn = '2026-02-30';
        },
        /Invalid observation date/u,
      ],
      [
        'invalid note date',
        manifest => {
          manifest.pages[2]!.notes![0]!.date = '2026-02-30';
        },
        /Invalid note date/u,
      ],
      [
        'fixture ownership marker',
        manifest => {
          manifest.pages[2]!.notes![0]!.text = 'Seed note: retail-pos/store-case/injected';
        },
        /Reserved seed marker in note text/u,
      ],
    ];
    const stable = await f.snapshot();
    for (const [label, mutate, expectedError] of invalid) {
      const manifest = structuredClone(original);
      manifest.pages[0]!.title = 'This earlier valid edit must never be written';
      mutate(manifest);
      await f.saveManifest(manifest);
      const rejected = await f.cli({ code: 1 });
      assert.match(rejected.output, expectedError, label);
      assert.deepEqual(await f.snapshot(), stable, `${label} changed stored Knowledge`);
    }
    await f.cli({ url: pathToFileURL(join(f.directory, 'invalid-fresh.db')).href, code: 1 });
    await noFile(join(f.directory, 'invalid-fresh.db'));
    await noFile(join(f.directory, 'invalid-fresh.db.writer.sqlite'));
    await f.saveManifest(original);
    for (const body of [
      '# Unsafe\n\n[hidden](javascript:alert(1))',
      '# Unsafe\n\n[private](customer:north:store-1#cases/connection-check)',
      '# Unsafe\n\n<!-- knowledge-seed:page:retail-pos:injected -->',
      '# Unsafe\n\n[[[safety-policy]]]',
      '# Unsafe\n\n[Label][reference]',
    ]) {
      await writeFile(bodyPath, body);
      assert.equal(await readFile(bodyPath, 'utf8'), body);
      await f.cli({ code: 1 });
      assert.deepEqual(await f.snapshot(), stable);
    }
    await writeFile(bodyPath, originalBody);
    const caseFile = join(dirname(f.manifestFile), original.pages[2]!.file);
    const caseBody = await readFile(caseFile, 'utf8');
    const normalized = caseBody.trim();
    const fullBody = normalized + '\n\n' + 'x'.repeat(1_000_000 - normalized.length - 2);
    await writeFile(caseFile, fullBody);
    const oversized = await f.cli({ code: 1 });
    assert.match(oversized.output, /Rendered page body.*exceeds the 1000000-character read bound/u);
    assert.deepEqual(await f.snapshot(), stable);
    await writeFile(caseFile, caseBody);
    // Reject destination spellings whose CommonMark/GFM interpretation can bypass literal URL checks.
    const unsafeDestinations = [
      [
        '[Reference](\nhttps://fixture:secret@example.com/private\n)',
        /Multiline Markdown destinations are unsupported/u,
      ],
      [
        '![Indicator](\r\nhttps://fixture:secret@example.com/private\r\n)',
        /Multiline Markdown destinations are unsupported/u,
      ],
      ['[Reference](\njavascript:alert\n)', /Multiline Markdown destinations are unsupported/u],
      ['![Indicator](\ndata:text/plain,fixture\n)', /Multiline Markdown destinations are unsupported/u],
      [
        '[Reference](https://fixture&#58;secret&#64;example.com/private)',
        /Ambiguous Markdown destinations are unsupported/u,
      ],
      [
        '![Indicator](https://fixture&colon;secret&commat;example.com/private)',
        /Ambiguous Markdown destinations are unsupported/u,
      ],
      [
        '[Reference](https://fixture&#x3a;secret&#X40;example.com/private)',
        /Ambiguous Markdown destinations are unsupported/u,
      ],
      ['[Reference](https://fixture(part)@example.com/private)', /Ambiguous Markdown destinations are unsupported/u],
      ['![Indicator](https://fixture(part)@example.com/private)', /Ambiguous Markdown destinations are unsupported/u],
      ['https://fixture:secret@example.com/private', /Unsafe Markdown URL authority/u],
      ['HTTPS://fixture@example.com/private', /Unsafe Markdown URL authority/u],
      ['www.fixture:secret@example.com/private', /Unsafe Markdown URL authority/u],
      ['www.fixture(part)@example.com/private', /Unsafe Markdown URL authority/u],
      ['www.fixture@localhost', /Unsafe Markdown URL authority/u],
      [
        '[ref]\n\n> [ref]: https://fixture&colon;secret&commat;example.com/private',
        /Unsupported or reserved Markdown syntax/u,
      ],
      [
        '![ref\\]]\n\n- [ref\\]]: https://fixture&colon;secret&commat;example.com/private',
        /Unsupported or reserved Markdown syntax/u,
      ],
    ] as const;
    for (const [index, [markdown, error]] of unsafeDestinations.entries()) {
      for (const placement of ['body', 'note']) {
        const manifest = structuredClone(original);
        manifest.pages[0]!.title = 'This edit must not survive a rejected Markdown destination';
        const body = placement === 'body' ? `${originalBody}\n\n${markdown}` : originalBody;
        await writeFile(bodyPath, body);
        if (placement === 'note') manifest.pages[2]!.notes![0]!.text = markdown;
        const injected = await f.saveManifest(manifest);
        assert.equal(await readFile(bodyPath, 'utf8'), body);
        if (placement === 'note') assert.equal(injected.pages[2]!.notes![0]!.text, markdown);
        assert.match((await f.cli({ code: 1 })).output, error);
        assert.deepEqual(await f.snapshot(), stable, `${placement} destination ${index} changed existing storage`);
        const fresh = join(f.directory, `unsafe-${index}-${placement}.db`);
        await f.cli({ url: pathToFileURL(fresh).href, code: 1 });
        await noFile(fresh);
        await noFile(`${fresh}.writer.sqlite`);
      }
    }
    await writeFile(bodyPath, originalBody);
    await f.saveManifest(original);
    await f.knowledge(async knowledge => {
      await knowledge.upsertPage({
        scope: 'docs:north',
        path: 'unowned',
        name: 'Unowned source',
        body: 'Keep this existing source.',
        author: 'external-import',
      });
      await knowledge.upsertPage({
        scope: 'docs:north',
        path: 'seed-authored',
        name: 'seed-authored',
        body: 'Content-bearing page without an ownership marker.',
        author: 'seed:retail-pos',
      });
    });
    for (const target of ['unowned', 'seed-authored']) {
      const manifest = structuredClone(original);
      manifest.pages[0]!.title = 'Do not write this earlier edit';
      manifest.pages.push({
        key: 'collision',
        path: target,
        title: 'Replacement',
        file: 'connectivity.md',
        scope: { kind: 'docs', profile: 'north-store' },
      });
      await f.saveManifest(manifest);
      const before = await f.snapshot();
      assert.match((await f.cli({ code: 1 })).output, /not owned/u);
      assert.deepEqual(await f.snapshot(), before);
    }
    await f.saveManifest(original);

    const aliasPath = join(f.directory, 'database-alias.db');
    await symlink(f.database, aliasPath);
    const lock = await acquireWriterLock(pathToFileURL(aliasPath).href);
    const encodedAlias = f.url.replace(/support\.db$/u, 'support%2Edb');
    let beforeContention: Awaited<ReturnType<typeof f.snapshot>>;
    try {
      beforeContention = await f.snapshot();
      await f.cli({ url: encodedAlias, code: 75 });
      await f.cli({ url: encodedAlias, args: ['--recover-lock'], code: 75 });
      assert.deepEqual(await f.snapshot(), beforeContention);
      await assert.rejects(acquireWriterLock(pathToFileURL(f.database).href), { name: 'WriterBusyError' });
    } finally {
      await lock.release();
    }
    const emptyDatabase = join(f.directory, 'uninitialized.db');
    const emptyLock = await acquireWriterLock(pathToFileURL(emptyDatabase).href);
    try {
      await f.cli({ url: pathToFileURL(emptyDatabase).href, code: 75 });
      await noFile(emptyDatabase);
    } finally {
      await emptyLock.release();
    }

    // An abruptly stopped writer must release its lock without running cleanup.
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { acquireWriterLock } from ${JSON.stringify(pathToFileURL(join(f.root, 'src/mastra/knowledge/writer-lock.ts')).href)}; await acquireWriterLock(); console.log('locked'); setInterval(() => {}, 1000);`,
      ],
      { cwd: f.root, env: f.environment, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const childExit = once(child, 'exit');
    try {
      const marker = async () => {
        let output = '';
        for await (const value of child.stdout!.setEncoding('utf8')) {
          output += value;
          if (/^locked\r?\n/mu.test(output)) return;
        }
        throw new Error('Writer output ended before acquiring lock');
      };
      await Promise.race([
        marker(),
        childExit.then(() => {
          throw new Error('Writer exited before acquiring lock');
        }),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Writer did not acquire lock')), 10000);
          timer.unref();
        }),
      ]);
      await f.cli({ code: 75 });
    } finally {
      child.kill('SIGKILL');
      await childExit;
    }
    assert.ok((await f.cli()).report.pages.every(item => item.status === 'unchanged'));
    assert.deepEqual(await f.snapshot(), beforeContention);

    // An interrupted legacy writer or recovery may leave both files behind during an upgrade.
    await writeFile(`${f.database}.writer.lock`, '');
    await writeFile(`${f.database}.writer.lock.recovery`, 'abandoned recovery');
    assert.ok((await f.cli({ args: ['--recover-lock'] })).report.pages.every(item => item.status === 'unchanged'));
    assert.deepEqual(await f.snapshot(), beforeContention);

    const dangling = join(f.directory, 'dangling.db');
    await symlink(join(f.directory, 'absent.db'), dangling);
    await f.cli({ url: pathToFileURL(dangling).href, code: 1 });
    await noFile(join(f.directory, 'absent.db'));
    const hardAlias = join(f.directory, 'hard-alias.db');
    await link(f.database, hardAlias);
    try {
      assert.match((await f.cli({ url: pathToFileURL(hardAlias).href, code: 1 })).output, /hard-link/u);
      assert.deepEqual(await f.snapshot(), beforeContention);
    } finally {
      await rm(hardAlias);
    }

    const partialPath = join(f.directory, 'partial.db');
    const partialUrl = pathToFileURL(partialPath).href;
    await f.knowledge(async () => undefined, partialUrl);
    await f.sql(
      "CREATE TRIGGER interrupt_page BEFORE INSERT ON mastra_knowledge_pages WHEN NEW.key = 'safe-changes' BEGIN SELECT RAISE(FAIL, 'interrupted page write'); END",
      [],
      partialPath,
    );
    assert.match((await f.cli({ url: partialUrl, code: 1 })).output, /interrupted page write/u);
    const survivingGuide = await f.knowledge(async (_, storage) => {
      const [scope] = await storage.getScopesByAddress(['docs:north']);
      const existing = await storage.getPageByPath({
        scopeId: scope!.id,
        path: ['guides', 'connectivity'],
        read: 'all',
      });
      assert.ok(existing);
      assert.equal(existing.version, 1);
      const [policyScope] = await storage.getScopesByAddress(['tenant:north']);
      assert.equal(
        policyScope &&
          (await storage.getPageByPath({ scopeId: policyScope.id, path: ['policies', 'safe-changes'], read: 'all' })),
        null,
      );
      return existing;
    }, partialUrl);
    await f.sql('DROP TRIGGER interrupt_page', [], partialPath);
    const converged = (await f.cli({ url: partialUrl })).report;
    assert.equal(page(converged, 'connection-guide').id, survivingGuide.id);
    assert.equal(page(converged, 'connection-guide').status, 'unchanged');
    assert.equal(page(converged, 'safety-policy').status, 'created');
    assert.ok((await f.cli({ url: partialUrl })).report.pages.every(item => item.status === 'unchanged'));

    const unrelated = await f.knowledge(async knowledge => {
      const result = [];
      for (let index = 0; index < 101; index++)
        result.push(
          await knowledge.addNote({
            scope: 'customer:north:store-1',
            path: 'cases/connection-check',
            text: `Unrelated observation ${index}.`,
            author: 'technician:lee',
          }),
        );
      return result;
    });
    original.pages[2]!.notes![0]!.text =
      'Changed after an interrupted real native replacement. See [[connection-guide]].';
    original.pages[2]!.notes![0]!.date = '2026-01-19';
    const revised = await f.saveManifest(original);
    const oldId = first.notes[0]!.id!;
    await f.sql(
      `CREATE TRIGGER interrupt_note BEFORE UPDATE OF deletedAt ON mastra_knowledge_notes WHEN OLD.id = ${quote(oldId)} AND NEW.deletedAt IS NOT NULL BEGIN SELECT RAISE(FAIL, 'interrupted note removal'); END`,
    );
    assert.match((await f.cli({ code: 1 })).output, /interrupted note removal/u);
    const replacement = await f.knowledge(async (_, storage) => {
      const current = await notes(storage, history.id!);
      const owned = current.filter(item => item.text.startsWith('Seed note: retail-pos/store-case/follow-up\n'));
      assert.equal(owned.length, 2);
      const replacement = owned.find(item => item.id !== oldId)!;
      assert.ok(
        replacement.text.includes(
          revised.pages[2]!.notes![0]!.text.replace('[[connection-guide]]', '[[docs:north#guides/connectivity]]'),
        ),
      );
      assert.equal(replacement.when?.toISOString(), '2026-01-19T00:00:00.000Z');
      assert.equal(current.length, unrelated.length + 2);
      return replacement;
    });
    await f.sql('DROP TRIGGER interrupt_note');
    const repaired = (await f.cli()).report;
    assert.equal(repaired.notes[0]!.status, 'repaired');
    assert.equal(repaired.notes[0]!.id, replacement.id);
    assert.ok(repaired.pages.every(item => item.status === 'unchanged'));
    await f.knowledge(async (_, storage) => {
      const current = await notes(storage, history.id!);
      assert.equal(current.length, unrelated.length + 1);
      assert.deepEqual(
        current.filter(item => item.provenance.author === 'technician:lee'),
        unrelated,
      );
      assert.deepEqual(
        current.find(item => item.id === replacement.id),
        replacement,
      );
      assert.ok((await storage.getNote({ id: oldId, read: 'all', includeDeleted: true }))!.deletedAt);
      assert.deepEqual(replacement.mentions, [guide.id!]);
    });
    const convergedState = await f.snapshot();
    await f.cli();
    assert.deepEqual(await f.snapshot(), convergedState);
  } finally {
    await f.close();
  }
});
