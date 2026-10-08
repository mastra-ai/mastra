import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  PermissionError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { API_KEY, FakeAPI } from '../../test/fake-api';
import { MainbrellaSandbox } from '../sandbox';
import { MainbrellaFilesystem } from './index';

function setup(readOnly = false) {
  const api = new FakeAPI();
  const sandbox = new MainbrellaSandbox({ apiKey: API_KEY, apiUrl: 'http://localhost:8787', fetch: api.fetch });
  const filesystem = new MainbrellaFilesystem({ sandbox, readOnly });
  return { api, sandbox, filesystem };
}

describe('MainbrellaFilesystem', () => {
  it('shares the sandbox generation, round-trips binary bytes and text, and creates parents', async () => {
    const { api, sandbox, filesystem } = setup();
    const bytes = Buffer.from([0, 128, 255, 10]);
    await filesystem.writeFile('/input/a.bin', bytes);
    expect(await filesystem.readFile('/input/a.bin')).toEqual(bytes);
    await filesystem.writeFile('/a.txt', 'héllo');
    expect(await filesystem.readFile('/a.txt', { encoding: 'utf8' })).toBe('héllo');
    expect(sandbox.container).toBeDefined();
    expect(
      api.requests
        .filter(r => r.url.pathname.startsWith('/containers/files'))
        .every(r => r.url.searchParams.get('createdAt') === sandbox.container?.createdAt),
    ).toBe(true);
    await filesystem._destroy();
    expect(sandbox.status).toBe('running');
    expect(api.requests.some(r => r.method === 'DELETE' && r.url.pathname === '/containers')).toBe(false);
  });

  it('serializes concurrent appends without duplicating or losing bytes', async () => {
    const { filesystem } = setup();
    await Promise.all([
      filesystem.appendFile('log.txt', 'a'),
      filesystem.appendFile('log.txt', 'b'),
      filesystem.appendFile('log.txt', 'c'),
    ]);
    expect(await filesystem.readFile('log.txt', { encoding: 'utf8' })).toBe('abc');
  });

  it('honors write preconditions and rejects oversized files without modifying existing contents', async () => {
    const { filesystem } = setup();
    await filesystem.writeFile('original', 'old');
    await expect(filesystem.writeFile('original', 'new', { overwrite: false })).rejects.toBeInstanceOf(FileExistsError);
    await expect(filesystem.writeFile('original', 'new', { expectedMtime: new Date(0) })).rejects.toBeInstanceOf(
      StaleFileError,
    );
    await expect(filesystem.writeFile('original', Buffer.alloc(1048577))).rejects.toMatchObject({
      code: 'file_too_large',
    });
    expect(await filesystem.readFile('original', { encoding: 'utf8' })).toBe('old');
    await expect(filesystem.writeFile('missing/file', 'x', { recursive: false })).rejects.toBeInstanceOf(
      DirectoryNotFoundError,
    );
  });

  it('rejects read-only mutations before provisioning or touching the API', async () => {
    const { api, filesystem } = setup(true);
    await expect(filesystem.writeFile('x', 'x')).rejects.toBeInstanceOf(WorkspaceReadOnlyError);
    await expect(filesystem.mkdir('dir')).rejects.toBeInstanceOf(WorkspaceReadOnlyError);
    await expect(filesystem.moveFile('x', 'y')).rejects.toBeInstanceOf(WorkspaceReadOnlyError);
    expect(api.requests).toHaveLength(0);
  });

  it('paginates and recursively lists entries with extension filters', async () => {
    const { api, filesystem } = setup();
    api.pageSize = 1;
    await filesystem.writeFile('a.ts', 'a');
    await filesystem.writeFile('b.txt', 'b');
    await filesystem.writeFile('sub/c.ts', 'c');
    const entries = await filesystem.readdir('/', { recursive: true, extension: '.ts' });
    expect(entries.map(e => e.name)).toEqual(['a.ts', 'sub', 'sub/c.ts']);
    expect((await filesystem.readdir('/', { recursive: true, maxDepth: 0 })).map(e => e.name)).toEqual([
      'a.ts',
      'b.txt',
      'sub',
    ]);
    expect(api.requests.some(r => r.url.searchParams.get('offset') === '1')).toBe(true);
  });

  it('copies directory contents and moves without overwriting an existing destination', async () => {
    const { filesystem } = setup();
    await filesystem.writeFile('src/a', 'a');
    await filesystem.copyFile('src', 'dest', { recursive: true });
    expect(await filesystem.readFile('dest/a', { encoding: 'utf8' })).toBe('a');
    await expect(filesystem.copyFile('src', 'src/nested', { recursive: true })).rejects.toBeInstanceOf(FileExistsError);
    await expect(filesystem.moveFile('src/a', 'dest/a')).rejects.toBeInstanceOf(FileExistsError);
    expect(await filesystem.exists('src/a')).toBe(true);
    await filesystem.moveFile('src/a', 'moved');
    expect(await filesystem.exists('src/a')).toBe(false);
    expect(await filesystem.readFile('moved', { encoding: 'utf8' })).toBe('a');
  });

  it('distinguishes file and directory deletion and protects the root', async () => {
    const { filesystem } = setup();
    await filesystem.writeFile('dir/file', 'x');
    await expect(filesystem.deleteFile('dir')).rejects.toBeInstanceOf(IsDirectoryError);
    await expect(filesystem.rmdir('dir')).rejects.toBeInstanceOf(DirectoryNotEmptyError);
    await expect(filesystem.rmdir('/')).rejects.toBeInstanceOf(PermissionError);
    await filesystem.rmdir('dir', { recursive: true });
    expect(await filesystem.exists('dir')).toBe(false);
    await filesystem.deleteFile('missing', { force: true });
  });

  it('blocks lexical traversal, symlinks, and symlink ancestors', async () => {
    const { api, filesystem } = setup();
    api.addEntry('/workspace/link', 'symlink', undefined, '/tmp');
    await expect(filesystem.readFile('../tmp/secret')).rejects.toBeInstanceOf(PermissionError);
    await expect(filesystem.stat('link')).rejects.toBeInstanceOf(PermissionError);
    await expect(filesystem.readdir('link')).rejects.toBeInstanceOf(PermissionError);
    await expect(filesystem.writeFile('link/secret', 'x')).rejects.toBeInstanceOf(PermissionError);
    const entries = await filesystem.readdir('/');
    expect(entries).toMatchObject([{ name: 'link', isSymlink: true, symlinkTarget: '/tmp' }]);
  });

  it('rejects a symlink ancestor before creating a custom base directory', async () => {
    const { api, sandbox } = setup();
    api.addEntry('/tmp/link', 'symlink', undefined, '/workspace');
    const filesystem = new MainbrellaFilesystem({ sandbox, basePath: '/tmp/link/new-root' });
    await expect(filesystem.writeFile('data', 'x')).rejects.toBeInstanceOf(PermissionError);
    expect(api.requests.some(request => request.url.pathname === '/containers/files/mkdir')).toBe(false);
  });

  it('returns accurate size/mtime metadata and propagates unsupported capabilities', async () => {
    const { api, filesystem } = setup();
    await filesystem.writeFile('data', 'hello');
    expect(await filesystem.stat('data')).toMatchObject({
      name: 'data',
      path: '/workspace/data',
      size: 5,
      type: 'file',
    });
    const disabled = setup();
    disabled.api.capabilities.files.list = false;
    await expect(disabled.filesystem.readdir('/')).rejects.toMatchObject({ code: 'files_unavailable' });
  });
});
