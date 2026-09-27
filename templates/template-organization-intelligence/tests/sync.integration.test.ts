import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { LibSQLVector } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SourceCatalog } from '../src/mastra/workspaces/catalog.js';
import { ScopedDriveReader } from '../src/mastra/workspaces/drive-source.js';
import { extractRecord, MAX_RECORD_BYTES } from '../src/mastra/workspaces/extractors.js';
import type { EmbeddingFunction } from '../src/mastra/workspaces/source-index.js';
import { SourceIndex } from '../src/mastra/workspaces/source-index.js';
import { createSourceRuntime } from '../src/mastra/workspaces/sources.js';
import { createOrganizationApplication } from './fixtures/application.js';

import { docx, googleFixture, officeArchive, pdf, xlsx } from './fixtures/records.js';

const environment = {
  OPENAI_API_KEY: 'synthetic-key',
  GOOGLE_DRIVE_CLIENT_EMAIL: 'fixture@example.test',
  GOOGLE_DRIVE_PRIVATE_KEY: 'synthetic-private-key',
};
const textOf = (hits: Awaited<ReturnType<SourceIndex['search']>>) => hits.map(hit => hit.content).join('\n');

describe('synchronization integration', () => {
  let directory: string;
  let local: string;
  let calls: string[];
  let drive: ReturnType<typeof googleFixture>;
  const cleanups: Array<() => Promise<void>> = [];
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'organization-sync-'));
    local = join(directory, 'records');
    await mkdir(local);
    await mkdir(join(directory, '.mastra'));
    calls = [];
    drive = googleFixture();
    drive.files.set('remote-record', {
      id: 'remote-record',
      parent: 'root',
      name: 'policy.md',
      mimeType: 'text/markdown',
      content: Buffer.from('Drive remote charter requires board approval.'),
    });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    await rm(directory, { recursive: true, force: true });
  });
  const embed: EmbeddingFunction = async text => {
    calls.push(text);
    return [text.includes('invoice') ? 1 : 0.1, text.includes('remote') ? 1 : 0.1, 0.5];
  };
  const catalog = (): SourceCatalog => ({
    version: 1,
    sources: [
      { id: 'sample', provider: 'local', mountPath: '/sample', root: local, enabled: true },
      {
        id: 'drive',
        provider: 'google-drive',
        mountPath: '/drive',
        folderId: 'root',
        credentialRef: 'organization',
        enabled: true,
      },
    ],
  });
  async function sources(configuration = catalog()) {
    return createSourceRuntime({
      catalog: configuration,
      catalogPath: join(directory, 'source-catalog.json'),
      ledgerPath: join(directory, '.mastra/source-identities.json'),
      environment,
      driveAccessToken: async () => 'synthetic-token',
      driveRequest: drive.request,
    });
  }
  async function openIndex(
    options: { configuration?: SourceCatalog; embedding?: EmbeddingFunction; now?: () => Date } = {},
  ) {
    const index = new SourceIndex({
      databaseUrl: 'file:' + join(directory, '.mastra/index.db'),
      sources: await sources(options.configuration),
      embed: options.embedding ?? embed,
      now: options.now,
    });
    await index.initialize();
    cleanups.push(() => index.close());
    return index;
  }
  async function application() {
    const app = await createOrganizationApplication({
      projectRoot: directory,
      environment,
      embed,
      sources: await sources(),
    });
    const mastra = app.mastra;
    cleanups.push(async () => {
      await mastra.stopWorkers();
      await app.close();
    });
    await mastra.startWorkers();
    return { ...app, mastra };
  }
  async function tick(app: Awaited<ReturnType<typeof application>>) {
    const old = app.index.lastRun()?.runId;
    const schedules = await app.mastra.schedules.list();
    expect(schedules).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(schedules[0]!.nextFireAt + 1);
    await app.mastra.scheduler!.tick();
    await vi.waitFor(() => expect(app.index.lastRun()?.runId).not.toBe(old));
    vi.useRealTimers();
  }

  it('scheduled refresh updates changed records once', async () => {
    await writeFile(join(local, 'policy.md'), '# Invoices\nRetain invoice records for seven years.');
    const app = await application();
    expect(app.index.lastRun()?.sources.map(source => source.indexed)).toEqual([1, 1]);
    const hits = await app.index.search('invoice remote');
    expect(new Set(hits.map(hit => hit.metadata.sourceId))).toEqual(new Set(['sample', 'drive']));
    expect(hits.some(hit => (hit.scoreDetails?.bm25 ?? 0) > 0)).toBe(true);
    expect(hits.some(hit => (hit.scoreDetails?.vector ?? 0) > 0)).toBe(true);
    await writeFile(join(local, 'policy.md'), '# Invoices\nRetain invoice records for eight years.');
    await tick(app);
    expect(app.index.lastRun()?.sources[0]).toMatchObject({ indexed: 0, changed: 1 });
    expect(textOf(await app.index.search('invoice'))).toContain('eight years');
    expect(textOf(await app.index.search('invoice'))).not.toContain('seven years');
    const before = calls.length;
    const workflow = app.mastra.getWorkflow('sourceSyncWorkflow');
    const run = await workflow.createRun();
    await run.start({ inputData: { trigger: 'manual' } });
    expect(app.index.lastRun()?.sources.every(source => source.unchanged === 1)).toBe(true);
    expect(calls).toHaveLength(before);
  });

  it('restart and overlap preserve search consistency', async () => {
    await writeFile(join(local, 'policy.md'), 'Original committed invoice evidence.');
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => {
      entered = resolve;
    });
    const pause = new Promise<void>(resolve => {
      release = resolve;
    });
    let releaseQuery!: () => void;
    let queryEntered!: () => void;
    const pendingQuery = new Promise<void>(resolve => {
      queryEntered = resolve;
    });
    const queryPause = new Promise<void>(resolve => {
      releaseQuery = resolve;
    });
    let blocking = false;
    const index = await openIndex({
      embedding: async text => {
        if (text === 'paused query') {
          queryEntered();
          await queryPause;
        }
        if (blocking && text.includes('Replacement')) {
          entered();
          await pause;
        }
        return embed(text);
      },
    });
    await index.sync();
    await writeFile(join(local, 'policy.md'), 'Replacement invoice evidence.');
    blocking = true;
    const refresh = index.sync();
    await blocked;
    expect((await index.sync()).status).toBe('skipped');
    expect(textOf(await index.search('invoice'))).toContain('Original committed');
    release();
    await refresh;
    expect(textOf(await index.search('invoice'))).toContain('Replacement');
    const activeQuery = index.search('paused query');
    await pendingQuery;
    await writeFile(join(local, 'concurrent.md'), 'Added concurrent invoice evidence.');
    await index.sync();
    releaseQuery();
    expect(textOf(await activeQuery)).not.toContain('Added concurrent');
    expect(textOf(await index.search('invoice'))).toContain('Added concurrent');
    await writeFile(join(local, 'policy.md'), 'Candidate that must never be committed.');
    const failure = vi
      .spyOn(LibSQLVector.prototype, 'upsert')
      .mockRejectedValueOnce(new Error('synthetic index failure'));
    expect((await index.sync()).status).toBe('failed');
    failure.mockRestore();
    expect(textOf(await index.search('invoice'))).toContain('Replacement');
    await index.close();
    const before = calls.length;
    const reopened = await openIndex();
    expect(calls).toHaveLength(before);
    expect(textOf(await reopened.search('invoice'))).toContain('Replacement');
    const persistedDrive = (await reopened.search('remote')).find(hit => hit.metadata.sourceId === 'drive')!;
    await reopened.close();
    await writeFile(join(local, 'policy.md'), 'Replacement invoice evidence.');
    const callsBeforeRemount = calls.length;
    const remounted = catalog();
    remounted.sources[1] = { ...remounted.sources[1]!, mountPath: '/remounted-drive' };
    drive.setFailed(true);
    const remountedIndex = await openIndex({ configuration: remounted });
    expect(calls).toHaveLength(callsBeforeRemount);
    expect((await remountedIndex.sync()).status).toBe('partial');
    expect(calls).toHaveLength(callsBeforeRemount);
    const remountedDrive = (await remountedIndex.search('remote')).find(hit => hit.metadata.sourceId === 'drive')!;
    expect(remountedDrive.metadata).toMatchObject({
      recordId: persistedDrive.metadata.recordId,
      path: '/remounted-drive/policy.md',
      sourceStatus: { ready: true, stale: true },
    });
    await remountedIndex.close();
    drive.setFailed(false);
    const retired = catalog();
    retired.sources[1]!.enabled = false;
    const excluded = await openIndex({ configuration: retired });
    expect((await excluded.search('remote')).every(hit => hit.metadata.sourceId !== 'drive')).toBe(true);
    await excluded.close();
    const removed = catalog();
    removed.sources.splice(1);
    const noDrive = await openIndex({ configuration: removed });
    expect(noDrive.sourceStatus().map(row => row.sourceId)).toEqual(['sample']);
    await noDrive.close();
    const added = catalog();
    added.sources.push({
      id: 'new-drive',
      provider: 'google-drive',
      mountPath: '/new',
      folderId: 'new-root',
      credentialRef: 'organization',
      enabled: true,
    });
    drive.setFailed(true);
    const newSource = await openIndex({ configuration: added });
    expect(newSource.sourceStatus().find(row => row.sourceId === 'new-drive')?.ready).toBe(false);
    await newSource.sync();
    expect(newSource.sourceStatus().find(row => row.sourceId === 'new-drive')?.ready).toBe(false);
    drive.setFailed(false);
    drive.files.set('new-valid', {
      id: 'new-valid',
      parent: 'new-root',
      name: 'valid.md',
      mimeType: 'text/markdown',
      content: Buffer.from('Fresh source cached evidence.'),
    });
    drive.files.set('new-corrupt', {
      id: 'new-corrupt',
      parent: 'new-root',
      name: 'corrupt.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('corrupt PDF'),
    });
    await newSource.sync();
    expect(newSource.sourceStatus().find(row => row.sourceId === 'new-drive')).toMatchObject({
      ready: false,
      lastSuccessAt: null,
      records: 1,
    });
    expect(textOf(await newSource.search('Fresh source cached evidence'))).toContain('Fresh source cached evidence');
    drive.files.delete('new-corrupt');
    await newSource.sync();
    expect(newSource.sourceStatus().find(row => row.sourceId === 'new-drive')?.ready).toBe(true);
    await newSource.close();
    const remapped = catalog();
    const remote = remapped.sources[1]!;
    if (remote.provider === 'google-drive') remote.folderId = 'other-root';
    await expect(sources(remapped)).rejects.toThrow('changed provider or root');
    // Removing only the identity ledger cannot authorize incompatible cached records.
    await rm(join(directory, '.mastra/source-identities.json'));
    const incompatible = new SourceIndex({
      databaseUrl: 'file:' + join(directory, '.mastra/index.db'),
      sources: await sources(remapped),
      embed,
    });
    cleanups.push(() => incompatible.close());
    await expect(incompatible.initialize()).rejects.toThrow('changed root');
    const client = createClient({ url: 'file:' + join(directory, '.mastra/index.db') });
    expect((await client.execute('SELECT data FROM oi_runs')).rows.length).toBeGreaterThan(0);
    client.close();
  });

  it('reconcile missing records only after complete scan', async () => {
    await writeFile(join(local, 'invoice.md'), 'Local invoice survives Drive outages.');
    let date = new Date('2026-01-01T00:00:00Z');
    const index = await openIndex({ now: () => date });
    await index.sync();
    const lastSuccess = index.sourceStatus().find(row => row.sourceId === 'drive')!.lastSuccessAt;
    drive.setFailed(true);
    expect((await index.sync()).status).toBe('partial');
    const cached = (await index.search('remote')).find(hit => hit.metadata.sourceId === 'drive');
    expect(cached?.metadata.sourceStatus).toMatchObject({ stale: true, lastSuccessAt: lastSuccess });
    drive.setFailed(false);
    drive.files.delete('remote-record');
    drive.setIncomplete(true);
    await index.sync();
    expect(textOf(await index.search('remote'))).toContain('remote charter');
    drive.setIncomplete(false);
    expect((await index.sync()).sources[1]).toMatchObject({ removed: 1, status: 'success' });
    expect((await index.search('remote')).every(hit => hit.metadata.sourceId !== 'drive')).toBe(true);
    expect(new Set(drive.methods)).toEqual(new Set(['GET']));
    drive.files.set('cached-limit', {
      id: 'cached-limit',
      parent: 'root',
      name: 'cached.md',
      mimeType: 'text/markdown',
      content: Buffer.from('Cached limit sentinel.'),
    });
    await index.sync();
    drive.files.delete('cached-limit');
    for (let number = 0; number < 1_001; number++)
      drive.files.set('limit-' + number, {
        id: 'limit-' + number,
        parent: 'root',
        name: 'record-' + number + '.md',
        mimeType: 'text/markdown',
        content: Buffer.from('excess'),
      });
    const capped = await index.sync();
    expect(capped.sources[1]).toMatchObject({ removed: 0, status: 'partial' });
    expect(textOf(await index.search('Cached limit sentinel'))).toContain('Cached limit sentinel');
    date = new Date('2026-01-01T00:11:00Z');
    expect(index.sourceStatus()[0]?.stale).toBe(true);
  });

  it('reject unsupported and oversized records', async () => {
    await writeFile(join(local, 'good.md'), 'Valid neighboring invoice evidence.');
    await writeFile(join(local, 'bad.bin'), 'unsupported');
    await writeFile(join(local, 'bad.pdf'), 'corrupt');
    await writeFile(join(local, 'big.pdf'), Buffer.alloc(MAX_RECORD_BYTES + 1));
    await writeFile(join(local, 'long.md'), 'a'.repeat(1024 * 1024 + 1));
    await writeFile(join(local, 'bomb.docx'), officeArchive({ 'word/document.xml': 'a'.repeat(33 * 1024 * 1024) }));
    await writeFile(join(directory, 'outside.md'), 'SECRET OUTSIDE CONTENT');
    await symlink(join(directory, 'outside.md'), join(local, 'escape.md'));
    const index = await openIndex();
    const result = await index.sync();
    expect(result.sources[0]).toMatchObject({ indexed: 1, failed: 5, skipped: 5, status: 'partial' });
    expect(calls.some(text => text.includes('SECRET OUTSIDE CONTENT'))).toBe(false);
    expect(textOf(await index.search('invoice'))).toContain('Valid neighboring');
    expect(result.sources[0]?.errors.join(' ')).toMatch(/20 MiB/);
    await expect(index.search(' ')).rejects.toThrow('4000');
    await expect(index.search('q'.repeat(4_001))).rejects.toThrow('4000');
    await expect(index.search('invoice', 7)).rejects.toThrow('topK');
    await expect(
      extractRecord(
        'entity.docx',
        officeArchive({ 'word/document.xml': '<!DOCTYPE x [<!ENTITY x "boom">]><document/>' }),
      ),
    ).rejects.toThrow('XML');
  });

  it('real documents preserve native tabs tables and provenance', async () => {
    await writeFile(join(local, 'policy.md'), '# Controls\n| Owner | Rule |\n| Records | Retain seven years |');
    await writeFile(join(local, 'rules.pdf'), pdf(['Text bearing page evidence.', 'Second page archive certificate.']));
    await writeFile(join(local, 'mixed.pdf'), pdf(['Mixed document visible text.', '']));
    await writeFile(join(local, 'scanned.pdf'), pdf(['']));
    await writeFile(join(local, 'policy.docx'), docx());
    drive.files.set('folder', {
      id: 'folder',
      name: 'Nested',
      parent: 'root',
      mimeType: 'application/vnd.google-apps.folder',
      content: Buffer.alloc(0),
    });
    drive.files.set('doc-id', {
      id: 'doc-id',
      name: 'Native policy',
      parent: 'folder',
      mimeType: 'application/vnd.google-apps.document',
      content: docx(),
      docs: {
        tabs: [
          {
            tabProperties: { tabId: 'first', title: 'Overview' },
            documentTab: {
              body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Overview introduction.' } }] } }] },
            },
            childTabs: [
              {
                tabProperties: { tabId: 'second', title: 'Rules' },
                documentTab: {
                  body: {
                    content: [
                      {
                        table: {
                          tableRows: [
                            {
                              tableCells: [
                                {
                                  content: [{ paragraph: { elements: [{ textRun: { content: 'Board authority' } }] } }],
                                },
                                {
                                  content: [
                                    {
                                      paragraph: {
                                        elements: [{ textRun: { content: 'Approves the annual archive charter' } }],
                                      },
                                    },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    });
    drive.files.set('sheet-id', {
      id: 'sheet-id',
      name: 'Native workbook',
      parent: 'root',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      content: xlsx(),
    });
    const index = await openIndex();
    const result = await index.sync();
    expect(result.sources[0]?.errors.join(' ')).toContain('partial');
    const pdfHits = await index.search('archive certificate');
    expect(pdfHits.find(hit => hit.content.includes('certificate'))?.metadata.locator).toBe('page 2');
    expect(textOf(await index.search('Archivist Nine days'))).toContain('Archivist | Nine days');
    const native = (await index.search('annual archive charter')).find(
      hit => hit.metadata.url?.toString().includes('doc-id') && hit.content.includes('annual archive charter'),
    );
    expect(native?.metadata.locator).toContain('tab second');
    expect(native?.metadata.path).toBe('/drive/Nested/Native policy');
    const sheet = (await index.search('eleven years')).find(hit => hit.content.includes('eleven years'));
    expect(sheet?.metadata.locator).toBe('Details!A2:B2');
    expect(sheet?.content).toContain('Retention rule');
    expect(sheet?.metadata.url).toContain('sheet-id');
    expect(result.sources[1]?.errors.join(' ')).toContain('Missing cached formula');
    expect(drive.calls.some(call => call.includes('includeTabsContent=true'))).toBe(true);
    drive.files.set('duplicate', { ...drive.files.get('sheet-id')!, id: 'duplicate' });
    drive.files.set('shortcut', {
      id: 'shortcut',
      parent: 'root',
      name: 'Outside',
      mimeType: 'application/vnd.google-apps.shortcut',
      content: Buffer.alloc(0),
    });
    const ambiguous = await index.sync();
    expect(ambiguous.sources[1]?.errors.join(' ')).toContain('Ambiguous');
    expect(ambiguous.sources[1]?.errors.join(' ')).toContain('shortcuts');
    expect(drive.calls.every(call => !call.includes('/shortcut?'))).toBe(true);
    // A provider export failure and an over-limit export remain visible beside valid records.
    drive.files.set('too-large', {
      id: 'too-large',
      parent: 'root',
      name: 'Large workbook',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      content: Buffer.alloc(10_000_001),
    });
    drive.files.set('bad-export', {
      id: 'bad-export',
      parent: 'root',
      name: 'Broken workbook',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      content: Buffer.from('not an archive'),
    });
    const limited = await index.sync();
    expect(limited.sources[1]!.errors.join(' ')).toContain('byte limit');
    expect(limited.sources[1]!.errors.join(' ')).toContain('Office archive');
    expect(textOf(await index.search('annual archive charter'))).toContain('annual archive charter');
    const reader = new ScopedDriveReader('root', async () => 'fake', drive.request);
    await expect(
      reader.extract({ id: 'outside', name: 'outside', mimeType: 'text/markdown', path: 'outside', url: '' }),
    ).rejects.toThrow('not discovered');
  });

  it('native workbook accepts package root paths without allowing external or escaping targets', async () => {
    const extracted = await extractRecord('native-export.xlsx', xlsx('/xl/worksheets/rules.xml'));
    expect(extracted.chunks.find(chunk => chunk.locator === 'Details!A2:B2')?.text).toContain('eleven years');
    expect(extracted.chunks.find(chunk => chunk.locator === 'Summary!A1:A1')?.text).toContain('Summary only');
    for (const target of ['../../outside.xml', '/xl/worksheets/../../outside.xml', '//example.test/worksheet.xml']) {
      await expect(extractRecord('native-export.xlsx', xlsx(target))).rejects.toThrow('escapes the workbook');
    }
    await expect(extractRecord('native-export.xlsx', xlsx('/xl/worksheets/rules.xml', 'External'))).rejects.toThrow(
      'Unsupported worksheet relationship',
    );
  });

  it('new local file becomes searchable without restart', async () => {
    const app = await application();
    expect(textOf(await app.index.search('new invoice'))).not.toContain('new invoice record');
    drive.setFailed(true);
    await writeFile(join(local, 'manual.md'), 'A new invoice record added after startup.');
    const run = await app.mastra.getWorkflow('sourceSyncWorkflow').createRun();
    await run.start({ inputData: { trigger: 'manual' } });
    expect(textOf(await app.index.search('new invoice'))).toContain('new invoice record');
    await writeFile(join(local, 'scheduled.md'), 'Scheduled discovery finds the second invoice.');
    await tick(app);
    expect(textOf(await app.index.search('second invoice'))).toContain('second invoice');
    expect(app.index.sourceStatus().find(source => source.sourceId === 'drive')?.stale).toBe(true);
    const before = calls.length;
    await app.index.sync();
    expect(calls).toHaveLength(before);
    await app.mastra.stopWorkers();
    const schedule = (await app.mastra.schedules.list())[0]!;
    const scheduleStore = await app.storage.getStore('schedules');
    await scheduleStore!.updateSchedule(schedule.id, { nextFireAt: Date.now() - 3_600_000 });
    await app.mastra.startWorkers();
    const restarted = await app.mastra.schedules.list();
    expect(restarted).toHaveLength(1);
    expect(restarted[0]!.nextFireAt).toBeGreaterThan(Date.now());
    expect(restarted[0]!.lastRunId).toBe(schedule.lastRunId);
    expect(restarted[0]!.lastFireAt).toBe(schedule.lastFireAt);
  });
});
