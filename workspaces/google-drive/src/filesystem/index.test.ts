import { generateKeyPairSync } from 'node:crypto';
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleDriveFilesystem } from './index';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

interface FakeFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  size?: number;
  content?: Buffer;
  createdTime: string;
  modifiedTime?: string;
  trashed?: boolean;
}

class FakeDrive {
  files = new Map<string, FakeFile>();
  private counter = 0;

  constructor(rootId: string) {
    this.files.set(rootId, {
      id: rootId,
      name: 'root',
      mimeType: FOLDER_MIME,
      parents: [],
      createdTime: new Date(0).toISOString(),
      modifiedTime: new Date(0).toISOString(),
    });
  }

  nextId(prefix = 'f'): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  listChildren(parentId: string): FakeFile[] {
    return [...this.files.values()].filter(file => file.parents.includes(parentId) && !file.trashed);
  }

  fileFields(file: FakeFile) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size !== undefined ? String(file.size) : undefined,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      parents: file.parents,
      trashed: file.trashed,
    };
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function notFound(message = 'not found'): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFakeFetch(drive: FakeDrive): ReturnType<typeof vi.fn> {
  const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const { pathname, searchParams } = url;

    // Upload endpoints
    if (pathname.startsWith('/upload/drive/v3/files')) {
      const match = pathname.match(/^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/);
      const fileId = match?.[1] ? decodeURIComponent(match[1]) : undefined;
      const body = init?.body as Buffer | string;
      const raw = Buffer.isBuffer(body) ? body.toString('utf-8') : String(body);
      // Parse multipart: split on boundary markers and extract the two parts.
      const boundaryMatch = raw.match(/^--(mastra-\d+)/);
      const boundary = boundaryMatch?.[1] ?? '';
      const segments = raw.split(`--${boundary}`).map(s => s.replace(/^\r\n|\r\n$/g, ''));
      // segments[0] is empty, segments[1] is metadata part, segments[2] is content part
      const metadataPart = segments[1] ?? '';
      const contentPart = segments[2] ?? '';
      const metadataBody = metadataPart.split('\r\n\r\n', 2)[1] ?? '{}';
      const contentBody = contentPart.split('\r\n\r\n', 2)[1] ?? '';
      const metadata = JSON.parse(metadataBody);
      const content = Buffer.from(contentBody, 'utf-8');
      const now = new Date().toISOString();
      if (method === 'PATCH' && fileId) {
        const existing = drive.files.get(fileId);
        if (!existing) return notFound();
        existing.content = content;
        existing.size = content.length;
        existing.modifiedTime = now;
        return jsonResponse({ id: existing.id });
      }
      const id = drive.nextId('file');
      drive.files.set(id, {
        id,
        name: metadata.name,
        mimeType: 'application/octet-stream',
        parents: metadata.parents ?? [],
        size: content.length,
        content,
        createdTime: now,
        modifiedTime: now,
      });
      return jsonResponse({ id });
    }

    // Files endpoints
    const fileIdMatch = pathname.match(/^\/drive\/v3\/files\/([^/]+)(\/copy)?$/);
    if (fileIdMatch) {
      const fileId = decodeURIComponent(fileIdMatch[1]);
      const isCopy = Boolean(fileIdMatch[2]);
      const file = drive.files.get(fileId);

      if (isCopy && method === 'POST') {
        if (!file) return notFound();
        const body = JSON.parse(String(init?.body ?? '{}'));
        const id = drive.nextId('copy');
        const now = new Date().toISOString();
        drive.files.set(id, {
          id,
          name: body.name ?? file.name,
          mimeType: file.mimeType,
          parents: body.parents ?? file.parents,
          size: file.size,
          content: file.content ? Buffer.from(file.content) : undefined,
          createdTime: now,
          modifiedTime: now,
        });
        return jsonResponse({ id });
      }

      if (method === 'GET') {
        if (searchParams.get('alt') === 'media') {
          if (!file) return notFound();
          const bytes = new Uint8Array(file.content ?? Buffer.alloc(0));
          return new Response(bytes, { status: 200 });
        }
        if (!file) return notFound();
        return jsonResponse(drive.fileFields(file));
      }

      if (method === 'DELETE') {
        if (!file) return notFound();
        drive.files.delete(fileId);
        return new Response(null, { status: 204 });
      }

      if (method === 'PATCH') {
        if (!file) return notFound();
        const body = JSON.parse(String(init?.body ?? '{}'));
        if (body.name) file.name = body.name;
        const addParents = searchParams.get('addParents')?.split(',').filter(Boolean) ?? [];
        const removeParents = searchParams.get('removeParents')?.split(',').filter(Boolean) ?? [];
        file.parents = [...file.parents.filter(p => !removeParents.includes(p)), ...addParents];
        file.modifiedTime = new Date().toISOString();
        return jsonResponse({ id: file.id });
      }
    }

    if (pathname === '/drive/v3/files') {
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const id = drive.nextId('mk');
        const now = new Date().toISOString();
        drive.files.set(id, {
          id,
          name: body.name,
          mimeType: body.mimeType ?? 'application/octet-stream',
          parents: body.parents ?? [],
          createdTime: now,
          modifiedTime: now,
        });
        return jsonResponse(drive.fileFields(drive.files.get(id)!));
      }

      if (method === 'GET') {
        const q = searchParams.get('q') ?? '';
        const parentMatch = q.match(/'([^']+)' in parents/);
        const nameMatch = q.match(/name = '([^']+)'/);
        const pageSize = Number(searchParams.get('pageSize') ?? '1000');
        const pageToken = Number(searchParams.get('pageToken') ?? '0');
        let results = [...drive.files.values()].filter(file => !file.trashed);
        if (parentMatch) results = results.filter(file => file.parents.includes(parentMatch[1]));
        if (nameMatch) results = results.filter(file => file.name === nameMatch[1]);
        const page = results.slice(pageToken, pageToken + pageSize);
        const nextPageToken = pageToken + pageSize < results.length ? String(pageToken + pageSize) : undefined;
        return jsonResponse({ files: page.map(file => drive.fileFields(file)), nextPageToken });
      }
    }

    return new Response(`Unhandled ${method} ${pathname}`, { status: 500 });
  });

  vi.stubGlobal('fetch', handler);
  return handler;
}

describe('GoogleDriveFilesystem', () => {
  let drive: FakeDrive;
  let fs: GoogleDriveFilesystem;

  beforeEach(async () => {
    drive = new FakeDrive('root-folder');
    installFakeFetch(drive);
    fs = new GoogleDriveFilesystem({ folderId: 'root-folder', accessToken: 'test-token' });
    await fs._init();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('provider metadata', () => {
    it('reports provider info', () => {
      expect(fs.provider).toBe('google-drive');
      expect(fs.name).toBe('GoogleDriveFilesystem');
      expect(fs.id).toBe('google-drive:root-folder');
      expect(fs.getInfo().metadata).toMatchObject({ folderId: 'root-folder' });
    });

    it('supports custom id', () => {
      const custom = new GoogleDriveFilesystem({
        id: 'custom-drive',
        folderId: 'root-folder',
        accessToken: 'token',
      });
      expect(custom.id).toBe('custom-drive');
    });

    it('returns instructions', () => {
      expect(fs.getInstructions()).toContain('Google Drive');
    });

    it('rejects a trashed root folder during initialization', async () => {
      drive.files.get('root-folder')!.trashed = true;
      const trashedRoot = new GoogleDriveFilesystem({ folderId: 'root-folder', accessToken: 'token' });

      await expect(trashedRoot._init()).rejects.toThrow('is trashed');
    });

    it('rejects a non-folder root during initialization', async () => {
      drive.files.get('root-folder')!.mimeType = 'text/plain';
      const fileRoot = new GoogleDriveFilesystem({ folderId: 'root-folder', accessToken: 'token' });

      await expect(fileRoot._init()).rejects.toThrow('must be a folder');
    });

    it('honors read-only instructions override', () => {
      const readOnly = new GoogleDriveFilesystem({
        folderId: 'root-folder',
        accessToken: 'token',
        readOnly: true,
      });
      expect(readOnly.getInstructions()).toContain('read-only');
    });
  });

  describe('file operations', () => {
    it('writes and reads a file', async () => {
      await fs.writeFile('/notes/hello.txt', 'hello world');
      const buffer = await fs.readFile('/notes/hello.txt');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect((buffer as Buffer).toString('utf-8')).toBe('hello world');
      expect(await fs.readFile('/notes/hello.txt', { encoding: 'utf-8' })).toBe('hello world');
    });

    it('updates existing files in place', async () => {
      await fs.writeFile('/doc.txt', 'first');
      await fs.writeFile('/doc.txt', 'second');
      expect(await fs.readFile('/doc.txt', { encoding: 'utf-8' })).toBe('second');
    });

    it('throws StaleFileError when expectedMtime is set and Drive omits modifiedTime', async () => {
      await fs.writeFile('/doc.txt', 'first');
      const file = [...drive.files.values()].find(file => file.name === 'doc.txt');
      delete file!.modifiedTime;

      await expect(fs.writeFile('/doc.txt', 'second', { expectedMtime: new Date() })).rejects.toBeInstanceOf(
        StaleFileError,
      );
    });

    it('appends to files', async () => {
      await fs.writeFile('/log.txt', 'a');
      await fs.appendFile('/log.txt', 'b');
      expect(await fs.readFile('/log.txt', { encoding: 'utf-8' })).toBe('ab');
    });

    it('appendFile creates a new file when path does not exist', async () => {
      await fs.appendFile('/new/log.txt', 'first');
      expect(await fs.readFile('/new/log.txt', { encoding: 'utf-8' })).toBe('first');
    });

    it('appendFile throws IsDirectoryError when target is a folder', async () => {
      await fs.mkdir('/folder');
      await expect(fs.appendFile('/folder', 'data')).rejects.toBeInstanceOf(IsDirectoryError);
    });

    it('throws FileExistsError when overwrite is false', async () => {
      await fs.writeFile('/doc.txt', 'x');
      await expect(fs.writeFile('/doc.txt', 'y', { overwrite: false })).rejects.toBeInstanceOf(FileExistsError);
    });

    it('throws FileNotFoundError for missing files', async () => {
      await expect(fs.readFile('/missing.txt')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('throws IsDirectoryError when reading a folder', async () => {
      await fs.mkdir('/folder');
      await expect(fs.readFile('/folder')).rejects.toBeInstanceOf(IsDirectoryError);
    });

    it('deletes files', async () => {
      await fs.writeFile('/delete-me.txt', 'bye');
      await fs.deleteFile('/delete-me.txt');
      expect(await fs.exists('/delete-me.txt')).toBe(false);
    });

    it('force-deletes missing files silently', async () => {
      await expect(fs.deleteFile('/missing.txt', { force: true })).resolves.toBeUndefined();
    });

    it('copies files', async () => {
      await fs.writeFile('/a.txt', 'content');
      await fs.copyFile('/a.txt', '/b.txt');
      expect(await fs.readFile('/b.txt', { encoding: 'utf-8' })).toBe('content');
      expect(await fs.exists('/a.txt')).toBe(true);
    });

    it('does not overwrite destination directories when copying files', async () => {
      await fs.writeFile('/a.txt', 'content');
      await fs.mkdir('/existing-dir');

      await expect(fs.copyFile('/a.txt', '/existing-dir', { overwrite: true })).rejects.toBeInstanceOf(FileExistsError);
      expect(await fs.exists('/existing-dir')).toBe(true);
    });

    it('rejects copying a file onto itself', async () => {
      await fs.writeFile('/a.txt', 'content');

      await expect(fs.copyFile('/a.txt', '/a.txt', { overwrite: true })).rejects.toBeInstanceOf(FileExistsError);
      expect(await fs.readFile('/a.txt', { encoding: 'utf-8' })).toBe('content');
    });

    it('moves files across folders', async () => {
      await fs.writeFile('/src/file.txt', 'payload');
      await fs.moveFile('/src/file.txt', '/dest/file.txt');
      expect(await fs.exists('/src/file.txt')).toBe(false);
      expect(await fs.readFile('/dest/file.txt', { encoding: 'utf-8' })).toBe('payload');
    });

    it('does not overwrite destination directories when moving files', async () => {
      await fs.writeFile('/a.txt', 'content');
      await fs.mkdir('/existing-dir');

      await expect(fs.moveFile('/a.txt', '/existing-dir', { overwrite: true })).rejects.toBeInstanceOf(FileExistsError);
      expect(await fs.exists('/a.txt')).toBe(true);
      expect(await fs.exists('/existing-dir')).toBe(true);
    });

    it('sends Content-Type application/json for copy and folder-creation requests', async () => {
      await fs.writeFile('/src.txt', 'data');
      await fs.copyFile('/src.txt', '/copy.txt');

      const fetchMock = vi.mocked(globalThis.fetch);
      const copyCall = fetchMock.mock.calls.find(([input]) => {
        const url = typeof input === 'string' ? input : input.toString();
        return url.includes('/copy');
      });
      expect(copyCall).toBeDefined();
      const copyHeaders = copyCall![1]?.headers as Record<string, string>;
      expect(copyHeaders['Content-Type']).toBe('application/json');
    });
  });

  describe('directory operations', () => {
    it('creates directories recursively by default through writeFile', async () => {
      await fs.writeFile('/deep/nested/path/file.txt', 'ok');
      expect(await fs.exists('/deep/nested/path/file.txt')).toBe(true);
    });

    it('mkdir creates parent directories by default', async () => {
      await fs.mkdir('/missing/child');
      expect(await fs.exists('/missing/child')).toBe(true);
      expect(await fs.exists('/missing')).toBe(true);
    });

    it('mkdir throws with recursive: false when parent is missing', async () => {
      await expect(fs.mkdir('/missing/child', { recursive: false })).rejects.toBeInstanceOf(DirectoryNotFoundError);
    });

    it('mkdir is idempotent for existing directories', async () => {
      await fs.mkdir('/folder', { recursive: true });
      await expect(fs.mkdir('/folder', { recursive: true })).resolves.toBeUndefined();
    });

    it('rmdir refuses non-empty dirs without recursive', async () => {
      await fs.writeFile('/dir/file.txt', 'x');
      await expect(fs.rmdir('/dir')).rejects.toBeInstanceOf(DirectoryNotEmptyError);
    });

    it('rmdir removes recursively', async () => {
      await fs.writeFile('/dir/file.txt', 'x');
      await fs.rmdir('/dir', { recursive: true });
      expect(await fs.exists('/dir')).toBe(false);
    });

    it('readdir lists entries non-recursively', async () => {
      await fs.writeFile('/a.txt', '1');
      await fs.mkdir('/sub', { recursive: true });
      await fs.writeFile('/sub/b.txt', '2');
      const entries = await fs.readdir('/');
      const names = entries.map(e => e.name).sort();
      expect(names).toEqual(['a.txt', 'sub']);
    });

    it('readdir supports recursive listing', async () => {
      await fs.writeFile('/a.txt', '1');
      await fs.writeFile('/sub/b.txt', '2');
      const entries = await fs.readdir('/', { recursive: true });
      const names = entries.map(e => e.name).sort();
      expect(names).toEqual(['a.txt', 'sub', 'sub/b.txt']);
    });

    it('readdir filters by extension', async () => {
      await fs.writeFile('/a.txt', '1');
      await fs.writeFile('/b.md', '2');
      const entries = await fs.readdir('/', { extension: '.md' });
      expect(entries.map(e => e.name)).toEqual(['b.md']);
    });

    it('reads children across paginated Drive results', async () => {
      const now = new Date().toISOString();
      for (let i = 0; i < 1001; i += 1) {
        drive.files.set(`seed-${i}`, {
          id: `seed-${i}`,
          name: `seed-${i}.txt`,
          mimeType: 'application/octet-stream',
          parents: ['root-folder'],
          size: 1,
          content: Buffer.from('x'),
          createdTime: now,
          modifiedTime: now,
        });
      }

      const entries = await fs.readdir('/');

      expect(entries).toHaveLength(1001);
      expect(entries.at(-1)?.name).toBe('seed-1000.txt');
    });

    it('finds existing files on later Drive result pages', async () => {
      const now = new Date().toISOString();
      for (let i = 0; i < 1000; i += 1) {
        drive.files.set(`seed-${i}`, {
          id: `seed-${i}`,
          name: `seed-${i}.txt`,
          mimeType: 'application/octet-stream',
          parents: ['root-folder'],
          size: 1,
          content: Buffer.from('x'),
          createdTime: now,
          modifiedTime: now,
        });
      }
      drive.files.set('target-file', {
        id: 'target-file',
        name: 'target.txt',
        mimeType: 'application/octet-stream',
        parents: ['root-folder'],
        size: 6,
        content: Buffer.from('target'),
        createdTime: now,
        modifiedTime: now,
      });

      await expect(fs.exists('/target.txt')).resolves.toBe(true);
    });
  });

  describe('read-only mode', () => {
    it('blocks mutating operations', async () => {
      const readOnly = new GoogleDriveFilesystem({
        folderId: 'root-folder',
        accessToken: 'token',
        readOnly: true,
      });
      await readOnly._init();
      await expect(readOnly.writeFile('/x.txt', 'no')).rejects.toBeInstanceOf(WorkspaceReadOnlyError);
    });
  });

  describe('authentication', () => {
    it('uses getAccessToken callback when provided', async () => {
      const token = vi.fn().mockResolvedValue('dynamic-token');
      const authed = new GoogleDriveFilesystem({ folderId: 'root-folder', getAccessToken: token });
      await authed._init();
      await authed.writeFile('/a.txt', 'ok');
      expect(token).toHaveBeenCalled();
    });

    it('throws without any auth source', async () => {
      const missing = new GoogleDriveFilesystem({ folderId: 'root-folder' });
      await expect(missing._init()).rejects.toThrow(/accessToken, getAccessToken, or serviceAccount/);
    });

    it('normalizes service account private keys with literal \\n escapes (as stored in .env files)', async () => {
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      // Simulate what .env files do — replace real newlines with the two-character `\n` sequence
      const escapedKey = (privateKey as string).replace(/\n/g, '\\n');

      const previousFetch = globalThis.fetch;
      const tokenFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'sa-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://oauth2.googleapis.com/token')) return tokenFetch(input, init);
        return previousFetch(input, init);
      });

      const sa = new GoogleDriveFilesystem({
        folderId: 'root-folder',
        serviceAccount: { clientEmail: 'svc@example.iam.gserviceaccount.com', privateKey: escapedKey },
      });
      // If the key isn't normalized, createSign().sign() throws DECODER routines::unsupported.
      await expect(sa._init()).resolves.toBeUndefined();
      expect(tokenFetch).toHaveBeenCalledTimes(1);
    });

    it.each<[string, (pem: string) => string]>([
      ['surrounding double quotes', pem => `"${pem.replace(/\n/g, '\\n')}"`],
      ['surrounding single quotes', pem => `'${pem.replace(/\n/g, '\\n')}'`],
      ['CRLF line endings', pem => pem.replace(/\n/g, '\r\n')],
      ['real newlines (unchanged)', pem => pem],
      ['no trailing newline', pem => pem.trimEnd()],
      // Happens when copy/pasting a JSON value straight into .env — outer quotes + trailing comma.
      ['JSON-style value with trailing comma', pem => `"${pem.replace(/\n/g, '\\n')}",`],
      // Doubly wrapped — JSON-encoded string pasted into a .env value that the loader
      // also wrapped in quotes. This is what the real-world bug report looked like.
      ['doubly-quoted with escaped inner quotes', pem => `\\"${pem.replace(/\n/g, '\\n')}\\",`],
    ])('normalizes private keys with %s', async (_label, transform) => {
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      const key = transform(privateKey as string);

      const previousFetch = globalThis.fetch;
      const tokenFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'sa-token', expires_in: 3600 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://oauth2.googleapis.com/token')) return tokenFetch(input, init);
        return previousFetch(input, init);
      });

      const sa = new GoogleDriveFilesystem({
        folderId: 'root-folder',
        serviceAccount: { clientEmail: 'svc@example.iam.gserviceaccount.com', privateKey: key },
      });
      await expect(sa._init()).resolves.toBeUndefined();
      expect(tokenFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('stat', () => {
    it('returns metadata for files', async () => {
      await fs.writeFile('/notes/hello.txt', 'hello');
      const stats = await fs.stat('/notes/hello.txt');
      expect(stats.type).toBe('file');
      expect(stats.name).toBe('hello.txt');
      expect(stats.path).toBe('/notes/hello.txt');
      expect(stats.size).toBeGreaterThan(0);
    });

    it('returns metadata for directories', async () => {
      await fs.mkdir('/folder', { recursive: true });
      const stats = await fs.stat('/folder');
      expect(stats.type).toBe('directory');
    });
  });
});
