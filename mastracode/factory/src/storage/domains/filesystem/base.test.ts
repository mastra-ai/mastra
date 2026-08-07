import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FILESYSTEM_SCHEMAS, FilesystemStorage } from './base.js';

describe('FilesystemStorage', () => {
  let backend: LibSQLFactoryStorage;
  let domain: FilesystemStorage;

  beforeEach(async () => {
    backend = new LibSQLFactoryStorage({ id: 'filesystem-test', url: ':memory:' });
    domain = backend.registerDomain(new FilesystemStorage());
    await backend.init();
  });

  afterEach(async () => {
    await backend.close();
  });

  it('stores one JSON snapshot per resource and thread', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'src/index.ts' }, { path: 'README.md' }, { path: 'assets/logo.svg' }],
    });

    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'assets/logo.svg' },
      { path: 'README.md' },
      { path: 'src/index.ts' },
    ]);
    await expect(domain.deleteFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toBe(1);
  });

  it('replaces the existing snapshot without retaining stale files', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'stale.ts' }, { path: 'also-stale.ts' }],
    });
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'current.ts' }],
    });

    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'current.ts' },
    ]);

    await domain.replaceFiles({ resourceId: 'resource-1', threadId: 'thread-1', files: [] });
    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([]);
  });

  it('isolates equal thread ids under different resources', async () => {
    await domain.replaceFiles({ resourceId: 'resource-a', threadId: 'thread-1', files: [{ path: 'a.ts' }] });
    await domain.replaceFiles({ resourceId: 'resource-b', threadId: 'thread-1', files: [{ path: 'b.ts' }] });

    await expect(domain.listFiles({ resourceId: 'resource-a', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'a.ts' },
    ]);
    await expect(domain.listFiles({ resourceId: 'resource-b', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'b.ts' },
    ]);
  });

  it('rejects empty identifiers, unsafe paths, and duplicate paths', async () => {
    await expect(domain.listFiles({ resourceId: '', threadId: 'thread-1' })).rejects.toThrow(
      'resourceId must not be empty',
    );
    await expect(
      domain.replaceFiles({ resourceId: 'resource-1', threadId: 'thread-1', files: [{ path: '../file.ts' }] }),
    ).rejects.toThrow('relative path');
    await expect(
      domain.replaceFiles({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        files: [{ path: 'same.ts' }, { path: 'same.ts' }],
      }),
    ).rejects.toThrow('duplicate file path');
  });

  it('deletes only the selected thread snapshot', async () => {
    await domain.replaceFiles({ resourceId: 'resource-1', threadId: 'thread-1', files: [{ path: 'first.ts' }] });
    await domain.replaceFiles({ resourceId: 'resource-1', threadId: 'thread-2', files: [{ path: 'second.ts' }] });

    await expect(domain.deleteFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toBe(1);
    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([]);
    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-2' })).resolves.toEqual([
      { path: 'second.ts' },
    ]);
  });

  it('clears all snapshots', async () => {
    await domain.replaceFiles({ resourceId: 'resource-1', threadId: 'thread-1', files: [{ path: 'first.ts' }] });
    await domain.replaceFiles({ resourceId: 'resource-2', threadId: 'thread-2', files: [{ path: 'second.ts' }] });

    await domain.dangerouslyClearAll();

    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([]);
    await expect(domain.listFiles({ resourceId: 'resource-2', threadId: 'thread-2' })).resolves.toEqual([]);
  });

  it('declares a JSON snapshot with a capture timestamp', () => {
    expect(FILESYSTEM_SCHEMAS).toContainEqual(
      expect.objectContaining({
        name: 'filesystem_snapshots',
        columns: expect.objectContaining({ files: { type: 'json' }, captured_at: { type: 'timestamp' } }),
      }),
    );
  });
});
