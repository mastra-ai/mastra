import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { cp, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { LibSQLStore } from '@mastra/libsql';
import type { Knowledge, KnowledgeStorage } from '@mastra/core/knowledge';
import { createKnowledge } from '../../src/mastra/knowledge/index.ts';
import { acquireWriterLock } from '../../src/mastra/knowledge/writer-lock.ts';
import type { SeedReport } from '../../src/mastra/knowledge/seed.ts';
import { principals } from '../../src/mastra/identity.ts';
import { exampleProfiles } from '../../src/examples/retail-pos/profiles.ts';

const execute = promisify(execFile);
const template = fileURLToPath(new URL('../..', import.meta.url));

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
  await mkdir(join(root, 'scripts'), { recursive: true });
  for (const entry of ['src', 'knowledge-datasets', 'package.json'])
    await cp(join(template, entry), join(root, entry), { recursive: true });
  await cp(join(template, 'scripts/seed-knowledge.ts'), join(root, 'scripts/seed-knowledge.ts'));
  await symlink(join(template, 'node_modules'), join(root, 'node_modules'), 'dir');
  const database = join(directory, 'support.db');
  const url = pathToFileURL(database).href;
  const manifestFile = join(root, 'knowledge-datasets/retail-pos/manifest.json');
  const environment = {
    ...process.env,
    PATH: `${dirname(process.execPath)}:${process.env.PATH}`,
    SUPPORT_DATABASE_URL: url,
  };
  async function cli(
    options: { dataset?: string | null; example?: string; args?: string[]; url?: string; code?: number } = {},
  ) {
    let stdout = '';
    let stderr = '';
    let code = 0;
    const dataset = options.dataset === null ? [] : ['--dataset', options.dataset ?? 'retail-pos'];
    try {
      const result = await execute(
        join(dirname(process.execPath), 'npm'),
        ['run', 'knowledge:seed', '--', ...dataset, ...(options.args ?? [])],
        {
          cwd: root,
          env: { ...environment, SUPPORT_DATABASE_URL: options.url ?? url, SUPPORT_EXAMPLE: options.example },
          timeout: 30000,
          maxBuffer: 2_000_000,
        },
      );
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
    await writeFile(supportedBodyPath, `${await readFile(supportedBodyPath, 'utf8')}\n${supportedLinks}\n`);
    assert.ok((await readFile(supportedBodyPath, 'utf8')).includes(supportedLinks));
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
    await noFile(`${f.database}.writer.lock`);
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
      assert.match(record, /"state": "approved"/u);
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
    assert.equal((await f.cli()).report.repairedLinks, false);
    const alternateManifest = JSON.parse(
      await readFile(join(f.root, 'knowledge-datasets/software-integration/manifest.json'), 'utf8'),
    ) as Manifest;
    assert.equal(alternateManifest.id, 'software-integration');
    const alternate = (await f.cli({ dataset: alternateManifest.id })).report;
    assert.ok(alternate.pages.every(item => item.status === 'created' && item.destination.includes(':software')));
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
    await writeFile(join(f.directory, 'outside.md'), '# Outside dataset\n');
    await symlink(join(f.directory, 'outside.md'), join(f.root, 'knowledge-datasets/retail-pos/escape.md'));
    const first = (await f.cli()).report;
    const guide = page(first, 'connection-guide');
    const history = page(first, 'store-case');
    const invalid: Array<[string, (manifest: Manifest) => void]> = [
      [
        'schema version',
        manifest => {
          manifest.schemaVersion = 2;
        },
      ],
      [
        'duplicate alias',
        manifest => {
          manifest.pages[1]!.key = manifest.pages[0]!.key;
        },
      ],
      [
        'canonical collision',
        manifest => {
          manifest.pages.push({ ...manifest.pages[0]!, key: 'duplicate-destination' });
        },
      ],
      [
        'unsafe destination',
        manifest => {
          manifest.pages[2]!.path = '../escape';
        },
      ],
      [
        'missing file',
        manifest => {
          manifest.pages[2]!.file = 'missing.md';
        },
      ],
      [
        'relative path escape',
        manifest => {
          manifest.pages[2]!.file = '../outside.md';
        },
      ],
      [
        'absolute path',
        manifest => {
          manifest.pages[2]!.file = join(f.directory, 'outside.md');
        },
      ],
      [
        'symlink escape',
        manifest => {
          manifest.pages[2]!.file = 'escape.md';
        },
      ],
      [
        'unknown alias',
        manifest => {
          manifest.pages[2]!.links = ['missing-alias'];
        },
      ],
      [
        'shared to private canonical reference',
        manifest => {
          manifest.pages[0]!.notes = [
            { key: 'unsafe', text: 'Private [[customer:north:store-1#cases/connection-check]]' },
          ];
        },
      ],
      [
        'unmanaged native reference',
        manifest => {
          manifest.pages[2]!.notes![0]!.text = 'Unknown [[customer:north:store-1#unmanaged]]';
        },
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
      ],
      [
        'unsafe source URL',
        manifest => {
          manifest.pages[2]!.source = { kind: 'fixture', url: 'javascript:alert(1)' };
        },
      ],
      [
        'credential-bearing source URL',
        manifest => {
          manifest.pages[2]!.source = { kind: 'fixture', url: 'https://secret:password@example.com/source' };
        },
      ],
      [
        'invalid mandatory policy kind',
        manifest => {
          manifest.pages[1]!.kind = 'reference';
        },
      ],
      [
        'foreign mandatory policy',
        manifest => {
          manifest.pages[1]!.scope.profile = 'south-store';
        },
      ],
      [
        'invalid record',
        manifest => {
          manifest.pages[2]!.record!.observedOn = '2026-02-30';
        },
      ],
      [
        'invalid note date',
        manifest => {
          manifest.pages[2]!.notes![0]!.date = '2026-02-30';
        },
      ],
      [
        'fixture ownership marker',
        manifest => {
          manifest.pages[2]!.notes![0]!.text = 'Seed note: retail-pos/store-case/injected';
        },
      ],
    ];
    const stable = await f.snapshot();
    for (const [label, mutate] of invalid) {
      const manifest = structuredClone(original);
      manifest.pages[0]!.title = 'This earlier valid edit must never be written';
      mutate(manifest);
      await f.saveManifest(manifest);
      const rejected = await f.cli({ code: 1 });
      assert.ok(rejected.output.trim().length, label);
      assert.deepEqual(await f.snapshot(), stable, `${label} changed stored Knowledge`);
      await noFile(`${f.database}.writer.lock`);
    }
    await f.cli({ url: pathToFileURL(join(f.directory, 'invalid-fresh.db')).href, code: 1 });
    await noFile(join(f.directory, 'invalid-fresh.db'));
    await f.saveManifest(original);
    for (const body of [
      '# Unsafe\n\n[hidden](javascript:alert(1))',
      '# Unsafe\n\n[private](customer:north:store-1#cases/connection-check)',
      '# Unsafe\n\n<!-- knowledge-seed:page:retail-pos:injected -->',
      '# Unsafe\n\n[[[safety-policy]]]',
    ]) {
      await writeFile(bodyPath, body);
      assert.equal(await readFile(bodyPath, 'utf8'), body);
      await f.cli({ code: 1 });
      assert.deepEqual(await f.snapshot(), stable);
    }
    await writeFile(bodyPath, originalBody);
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
        await noFile(`${fresh}.writer.lock`);
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
    const beforeContention = await f.snapshot();
    const encodedAlias = `file:${f.database.replace('support.db', 'support%2Edb')}`;
    try {
      await f.cli({ url: encodedAlias, code: 75 });
      await f.cli({ url: encodedAlias, args: ['--recover-lock'], code: 75 });
      assert.deepEqual(await f.snapshot(), beforeContention);
      assert.equal(JSON.parse(await readFile(lock.lockPath, 'utf8')).pid, process.pid);
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

    // A real stopped process leaves its own lock behind, rather than fabricating stale ownership.
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
      const ready = await Promise.race([
        once(child.stdout!, 'data').then(([value]) => String(value)),
        childExit.then(() => {
          throw new Error('Writer exited before acquiring lock');
        }),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Writer did not acquire lock')), 10000);
          timer.unref();
        }),
      ]);
      assert.match(ready, /locked/u);
      await f.cli({ code: 75 });
    } finally {
      child.kill('SIGKILL');
      await childExit;
    }
    await f.cli({ code: 75 });
    assert.ok((await f.cli({ args: ['--recover-lock'] })).report.pages.every(item => item.status === 'unchanged'));
    assert.deepEqual(await f.snapshot(), beforeContention);
    await noFile(`${f.database}.writer.lock`);

    for (const uncertain of [
      'unreadable owner metadata',
      JSON.stringify({ pid: process.pid, host: 'another-host', token: 'uncertain' }),
    ]) {
      await writeFile(`${f.database}.writer.lock`, uncertain);
      await f.cli({ args: ['--recover-lock'], code: 1 });
      assert.equal(await readFile(`${f.database}.writer.lock`, 'utf8'), uncertain);
      assert.deepEqual(await f.snapshot(), beforeContention);
      await rm(`${f.database}.writer.lock`);
    }

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
