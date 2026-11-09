import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopedDriveReader } from '../../../src/mastra/workspaces/drive-source.js';
import * as localSource from '../../../src/mastra/workspaces/local-source.js';
import type { SourceIndex } from '../../../src/mastra/workspaces/source-index.js';
import { googleFixture } from '../../fixtures/records.js';
import { openSourceIndex } from './helpers/runtime.js';

describe('metadata-based synchronization', () => {
  let directory: string;
  let drive: ReturnType<typeof googleFixture>;
  const indices: SourceIndex[] = [];
  const embed = vi.fn(async () => [0.1, 0.2, 0.3]);
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'source-metadata-'));
    drive = googleFixture();
    drive.files.set('policy', {
      id: 'policy',
      parent: 'root',
      name: 'policy.md',
      mimeType: 'text/markdown',
      content: Buffer.from('Keep invoices for seven years.'),
      version: '1',
    });
    embed.mockClear();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const index of indices.splice(0)) await index.close();
    await rm(directory, { recursive: true, force: true });
  });
  async function openIndex() {
    const index = await openSourceIndex(directory, drive, embed);
    indices.push(index);
    return index;
  }

  it('skips content reads and embeddings for unchanged files, including after restart', async () => {
    const localRead = vi.spyOn(localSource, 'extractLocalRecord');
    const driveRead = vi.spyOn(ScopedDriveReader.prototype, 'extract');
    const index = await openIndex();
    await writeFile(join(directory, 'records', 'policy.md'), 'Local retention policy.');
    await index.sync();
    expect(localRead).toHaveBeenCalledTimes(1);
    expect(driveRead).toHaveBeenCalledTimes(1);
    const embeddingCalls = embed.mock.calls.length;
    localRead.mockClear();
    driveRead.mockClear();
    drive.calls.length = 0;
    expect((await index.sync()).sources.map(source => source.unchanged)).toEqual([1, 1]);
    await index.close();
    const reopened = await openIndex();
    expect((await reopened.sync()).sources.map(source => source.unchanged)).toEqual([1, 1]);
    expect(localRead).not.toHaveBeenCalled();
    expect(driveRead).not.toHaveBeenCalled();
    expect(embed).toHaveBeenCalledTimes(embeddingCalls);
    expect(drive.calls.every(url => new URL(url).pathname === '/drive/v3/files')).toBe(true);
  });

  it('updates a Drive path without replacing the record or rereading unchanged content', async () => {
    const index = await openIndex();
    await index.sync();
    const before = (await index.search('invoices'))[0]!;
    drive.files.set('folder', {
      id: 'folder',
      name: 'Archive',
      parent: 'root',
      mimeType: 'application/vnd.google-apps.folder',
      content: Buffer.alloc(0),
    });
    drive.files.get('policy')!.parent = 'folder';
    const read = vi.spyOn(ScopedDriveReader.prototype, 'extract');
    const result = await index.sync();
    expect(result.sources[1]).toMatchObject({ changed: 1, indexed: 0, removed: 0 });
    expect(read).not.toHaveBeenCalled();
    expect((await index.search('invoices'))[0]!.metadata).toMatchObject({
      recordId: before.metadata.recordId,
      path: '/drive/Archive/policy.md',
      revision: before.metadata.revision,
    });
  });

  it('refreshes changed Drive versions and local files even when size and modification time are restored', async () => {
    const index = await openIndex();
    const path = join(directory, 'records', 'policy.md');
    await writeFile(path, 'Keep records for seven years.');
    await index.sync();
    const previous = await stat(path);
    await writeFile(path, 'Keep records for eight years.');
    await utimes(path, previous.atime, previous.mtime);
    const file = drive.files.get('policy')!;
    file.content = Buffer.from('Keep invoices for eight years.');
    file.version = '2';
    const result = await index.sync();
    expect(result.sources.map(source => source.changed)).toEqual([1, 1]);
    const hits = await index.search('eight years');
    expect(hits.every(hit => hit.content.includes('eight years'))).toBe(true);
  });

  it('uses modified time when version is absent and reads content when both are missing', async () => {
    const file = drive.files.get('policy')!;
    delete file.version;
    file.modifiedTime = '2026-01-01T00:00:00Z';
    const index = await openIndex();
    await index.sync();
    const read = vi.spyOn(ScopedDriveReader.prototype, 'extract');
    await index.sync();
    expect(read).not.toHaveBeenCalled();
    file.modifiedTime = '2026-01-02T00:00:00Z';
    await index.sync();
    expect(read).toHaveBeenCalledTimes(1);
    delete file.modifiedTime;
    await index.sync();
    await index.sync();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('invalidates old extraction versions without regenerating identical embeddings', async () => {
    const index = await openIndex();
    await writeFile(join(directory, 'records', 'policy.md'), 'Local retention policy.');
    await index.sync();
    await index.close();
    const db = createClient({ url: 'file:' + join(directory, 'index.db') });
    try {
      for (const row of (await db.execute('SELECT id,data FROM oi_committed_records')).rows) {
        const record = JSON.parse(String(row.data));
        record.cache.extractionVersion = 'obsolete';
        await db.execute({
          sql: 'UPDATE oi_committed_records SET data=? WHERE id=?',
          args: [JSON.stringify(record), row.id!],
        });
      }
    } finally {
      db.close();
    }
    const localRead = vi.spyOn(localSource, 'extractLocalRecord');
    const driveRead = vi.spyOn(ScopedDriveReader.prototype, 'extract');
    const calls = embed.mock.calls.length;
    const reopened = await openIndex();
    await reopened.sync();
    expect(localRead).toHaveBeenCalledTimes(1);
    expect(driveRead).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledTimes(calls);
  });

  it('retains committed evidence when Drive changes during download', async () => {
    const request = drive.request;
    let changeDuringRead = false;
    drive.request = async (input, options) => {
      const response = await request(input, options);
      if (changeDuringRead && new URL(String(input)).searchParams.get('alt') === 'media') {
        drive.files.get('policy')!.version = '3';
      }
      return response;
    };
    const index = await openIndex();
    await index.sync();
    drive.files.get('policy')!.version = '2';
    drive.files.get('policy')!.content = Buffer.from('Unstable replacement text.');
    changeDuringRead = true;
    expect((await index.sync()).sources[1]).toMatchObject({ failed: 1, changed: 0, status: 'partial' });
    expect((await index.search('invoices'))[0]!.content).toContain('seven years');
    changeDuringRead = false;
    expect((await index.sync()).sources[1]).toMatchObject({ changed: 1, status: 'success' });
  });

  it('rejects local content changed between discovery and reading', async () => {
    await openIndex();
    const root = join(directory, 'records');
    await writeFile(join(root, 'policy.md'), 'First version.');
    const metadata = await localSource.localValidator(root, 'policy.md');
    await writeFile(join(root, 'policy.md'), 'Changed version.');
    await expect(localSource.extractLocalRecord(root, 'policy.md', metadata)).rejects.toThrow(
      'changed during synchronization',
    );
  });
});
