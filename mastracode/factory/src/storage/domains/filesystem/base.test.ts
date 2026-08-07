import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FilesystemStorage } from './base.js';

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

  it('round trips root and nested files sorted by path', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [
        { path: 'src/index.ts', filename: 'index.ts' },
        { path: 'README.md', filename: 'README.md' },
        { path: 'assets/logo.svg', filename: 'logo.svg' },
      ],
    });

    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'assets/logo.svg', filename: 'logo.svg' },
      { path: 'README.md', filename: 'README.md' },
      { path: 'src/index.ts', filename: 'index.ts' },
    ]);
  });

  it('replaces a thread file list without retaining stale rows', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [
        { path: 'stale.ts', filename: 'stale.ts' },
        { path: 'also-stale.ts', filename: 'also-stale.ts' },
      ],
    });
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'current.ts', filename: 'current.ts' }],
    });

    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'current.ts', filename: 'current.ts' },
    ]);

    await domain.replaceFiles({ resourceId: 'resource-1', threadId: 'thread-1', files: [] });
    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([]);
  });

  it('isolates equal thread ids under different resources', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-a',
      threadId: 'thread-1',
      files: [{ path: 'a.ts', filename: 'a.ts' }],
    });
    await domain.replaceFiles({
      resourceId: 'resource-b',
      threadId: 'thread-1',
      files: [{ path: 'b.ts', filename: 'b.ts' }],
    });

    await expect(domain.listFiles({ resourceId: 'resource-a', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'a.ts', filename: 'a.ts' },
    ]);
    await expect(domain.listFiles({ resourceId: 'resource-b', threadId: 'thread-1' })).resolves.toEqual([
      { path: 'b.ts', filename: 'b.ts' },
    ]);
  });

  it('rejects empty identifiers and invalid files', async () => {
    await expect(domain.listFiles({ resourceId: '', threadId: 'thread-1' })).rejects.toThrow(
      'resourceId must not be empty',
    );
    await expect(
      domain.replaceFiles({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        files: [{ path: '../file.ts', filename: 'file.ts' }],
      }),
    ).rejects.toThrow('relative path');
    await expect(
      domain.replaceFiles({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        files: [{ path: 'file.ts', filename: 'other.ts' }],
      }),
    ).rejects.toThrow('filename must match');
    await expect(
      domain.replaceFiles({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        files: [
          { path: 'same.ts', filename: 'same.ts' },
          { path: 'same.ts', filename: 'same.ts' },
        ],
      }),
    ).rejects.toThrow('duplicate file path');
  });

  it('deletes only the selected thread files', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'first.ts', filename: 'first.ts' }],
    });
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-2',
      files: [{ path: 'second.ts', filename: 'second.ts' }],
    });

    await expect(domain.deleteFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toBe(1);
    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([]);
    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-2' })).resolves.toEqual([
      { path: 'second.ts', filename: 'second.ts' },
    ]);
  });

  it('clears all files', async () => {
    await domain.replaceFiles({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      files: [{ path: 'first.ts', filename: 'first.ts' }],
    });
    await domain.replaceFiles({
      resourceId: 'resource-2',
      threadId: 'thread-2',
      files: [{ path: 'second.ts', filename: 'second.ts' }],
    });

    await domain.dangerouslyClearAll();

    await expect(domain.listFiles({ resourceId: 'resource-1', threadId: 'thread-1' })).resolves.toEqual([]);
    await expect(domain.listFiles({ resourceId: 'resource-2', threadId: 'thread-2' })).resolves.toEqual([]);
  });
});
