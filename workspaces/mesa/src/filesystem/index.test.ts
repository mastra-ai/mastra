import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import type { MesaFileSystem } from '@mesadev/sdk';
import type { Mocked } from 'vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MesaFilesystem } from './index';
import type { MesaFilesystemOptions } from './index';

const authors: MesaFilesystemOptions['authors'] = [{ name: 'Mastra Agent', email: 'agent@example.com' }];
const layout = { '/docs': { kind: 'repo', name: 'docs', mode: 'rw', at: { bookmark: 'main' } } } as const;

const mesaSdkMock = vi.hoisted(() => ({
  Mesa: vi.fn(),
  fs: vi.fn(),
  mount: vi.fn(),
  filesystem: undefined as Mocked<MesaFileSystem> | undefined,
}));

vi.mock('@mesadev/sdk', () => ({
  Mesa: mesaSdkMock.Mesa,
}));

function notFound(path: string): Error & { code: string } {
  return Object.assign(new Error(`not found: ${path}`), { code: 'ENOENT' });
}

function createStat(overrides: Partial<Awaited<ReturnType<MesaFileSystem['stat']>>> = {}) {
  return {
    isFile: true,
    isDirectory: false,
    isSymbolicLink: false,
    mode: 0o644,
    size: 5,
    mtime: new Date('2025-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createMockMesaFileSystem(): Mocked<MesaFileSystem> {
  return {
    readFile: vi.fn(),
    readFileBuffer: vi.fn().mockResolvedValue(new Uint8Array()),
    writeFile: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(false),
    stat: vi.fn().mockResolvedValue(createStat()),
    lstat: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn(),
    readdirWithFileTypes: vi.fn().mockResolvedValue([]),
    rm: vi.fn().mockResolvedValue(undefined),
    cp: vi.fn().mockResolvedValue(undefined),
    mv: vi.fn().mockResolvedValue(undefined),
    resolvePath: vi.fn(),
    getAllPaths: vi.fn(),
    chmod: vi.fn(),
    symlink: vi.fn(),
    link: vi.fn(),
    readlink: vi.fn(),
    realpath: vi.fn().mockImplementation(async (path: string) => path),
    utimes: vi.fn(),
    setMetadata: vi.fn(),
    getMetadata: vi.fn(),
    clearMetadata: vi.fn(),
    subscribe: vi.fn(),
    change: {
      new: vi.fn(),
      edit: vi.fn(),
      list: vi.fn(),
      current: vi.fn().mockResolvedValue({ changeId: 'zzzz', commitOid: 'abc123' }),
    },
    bookmark: {
      create: vi.fn(),
      move: vi.fn(),
      list: vi.fn(),
    },
    bash: vi.fn().mockReturnValue({ kind: 'bash' }),
  } as unknown as Mocked<MesaFileSystem>;
}

function createFs(options: Partial<ConstructorParameters<typeof MesaFilesystem>[0]> = {}) {
  const mesaFs = createMockMesaFileSystem();
  mesaSdkMock.filesystem = mesaFs;
  const fs = new MesaFilesystem({ authors, layout, ...options });

  return { fs, mesaFs };
}

describe('MesaFilesystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mesaSdkMock.filesystem = undefined;
    mesaSdkMock.mount.mockImplementation(async () => mesaSdkMock.filesystem);
    mesaSdkMock.fs.mockImplementation(() => ({ mount: mesaSdkMock.mount }));
    mesaSdkMock.Mesa.mockImplementation(function (this: { fs: typeof mesaSdkMock.fs }) {
      this.fs = mesaSdkMock.fs;
    });
  });

  describe('constructor and metadata', () => {
    it('generates unique ids when not provided', () => {
      const fs1 = new MesaFilesystem({ authors, layout });
      const fs2 = new MesaFilesystem({ authors, layout });

      expect(fs1.id).toMatch(/^mesa-fs-/);
      expect(fs2.id).toMatch(/^mesa-fs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses fixed display metadata', () => {
      const { fs } = createFs({ readOnly: true });

      expect(fs.id).toMatch(/^mesa-fs-/);
      expect(fs.name).toBe('MesaFilesystem');
      expect(fs.provider).toBe('mesa');
      expect(fs.displayName).toBe('Mesa');
      expect(fs.icon).toBe('mesa');
      expect(fs.description).toBe('Versioned Mesa filesystem for workspace files');
      expect(fs.readOnly).toBe(true);
    });

    it('returns filesystem info without exposing credentials', () => {
      const { fs } = createFs({ privateKey: 'mesa-secret' });

      const info = fs.getInfo();

      expect(info).toEqual(
        expect.objectContaining({
          id: fs.id,
          name: 'MesaFilesystem',
          provider: 'mesa',
          icon: 'mesa',
          metadata: {
            paths: ['/docs'],
            mode: 'client',
          },
        }),
      );
      expect(JSON.stringify(info)).not.toContain('mesa-secret');
    });

    it('builds instructions with layout paths and read-only context', () => {
      const { fs } = createFs({ readOnly: true });

      expect(fs.getInstructions()).toContain('Mounted paths: "/docs"');
      expect(fs.getInstructions()).toContain('Mounted read-only');
    });
  });

  describe('lifecycle', () => {
    it('creates and mounts a Mesa client during init', async () => {
      const cache = { diskCache: { path: '/tmp/mesa-cache' } };
      const telemetry = { logLevel: 'warn' as const };
      const { fs, mesaFs } = createFs({ cache, telemetry });

      await fs.readFile('/docs/README.md');

      expect(fs.filesystem).toBe(mesaFs);
      expect(fs.status).toBe('ready');
      expect(mesaSdkMock.Mesa).toHaveBeenCalledWith(expect.objectContaining({ privateKey: undefined }));
      expect(mesaSdkMock.fs).toHaveBeenCalledWith({ layout, ttl: undefined, authors });
      expect(mesaSdkMock.mount).toHaveBeenCalledWith({ cache, telemetry });
    });

    it('mounts every layout repo read-only when provider readOnly is true', async () => {
      const { fs } = createFs({
        readOnly: true,
        layout: {
          '/docs': {
            kind: 'repo',
            name: 'docs',
            mode: 'rw',
            subPaths: { assets: [{ kind: 'repo', name: 'assets', mode: 'rw' }] },
          },
          '/refs': [{ kind: 'repo', name: 'website', mode: 'rw' }],
        },
      });

      await fs.readFile('/docs/README.md');

      expect(mesaSdkMock.fs).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            '/docs': {
              kind: 'repo',
              name: 'docs',
              mode: 'ro',
              subPaths: { assets: [{ kind: 'repo', name: 'assets', mode: 'ro' }] },
            },
            '/refs': [{ kind: 'repo', name: 'website', mode: 'ro' }],
          },
        }),
      );
    });

    it('rejects branchedFrom repos when provider readOnly is true', async () => {
      const { fs } = createFs({
        readOnly: true,
        layout: {
          '/docs': { kind: 'repo', name: 'docs', mode: 'rw', branchedFrom: { bookmark: 'main' } },
        },
      });

      await expect(fs.readFile('/docs/README.md')).rejects.toThrow(/cannot mount repo "docs" with branchedFrom/);
      expect(mesaSdkMock.fs).not.toHaveBeenCalled();
    });

    it('throws when mounting an empty layout', async () => {
      const { fs } = createFs({ layout: {} });

      await expect(fs.readFile('/docs/README.md')).rejects.toThrow(/requires a layout with at least one path/);
      expect(fs.status).toBe('error');
    });
  });

  describe('file operations', () => {
    it('reads Buffer content by default', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readFileBuffer.mockResolvedValueOnce(new Uint8Array([104, 105]));

      const result = await fs.readFile('docs/hi.txt');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('hi');
      expect(mesaFs.readFileBuffer).toHaveBeenCalledWith('/docs/hi.txt');
    });

    it('returns encoded string content when requested', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readFileBuffer.mockResolvedValueOnce(new TextEncoder().encode('hello'));

      const result = await fs.readFile('/docs/hello.txt', { encoding: 'utf-8' });

      expect(result).toBe('hello');
    });

    it('maps missing reads to FileNotFoundError', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readFileBuffer.mockRejectedValueOnce(notFound('/missing.txt'));

      await expect(fs.readFile('/missing.txt')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('writes strings and creates parent directories by default', async () => {
      const { fs, mesaFs } = createFs();

      await fs.writeFile('/docs/new/file.txt', 'hello');

      expect(mesaFs.mkdir).toHaveBeenCalledWith('/docs/new', { recursive: true });
      expect(mesaFs.writeFile).toHaveBeenCalledWith('/docs/new/file.txt', 'hello');
    });

    it('anchors relative paths before normalizing parent traversal', async () => {
      const { fs, mesaFs } = createFs();

      await fs.writeFile('../docs/file.txt', 'hello');

      expect(mesaFs.mkdir).toHaveBeenCalledWith('/docs', { recursive: true });
      expect(mesaFs.writeFile).toHaveBeenCalledWith('/docs/file.txt', 'hello');
    });

    it('requires existing parent directory when recursive=false', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockRejectedValueOnce(notFound('/docs/new'));

      await expect(fs.writeFile('/docs/new/file.txt', 'hello', { recursive: false })).rejects.toBeInstanceOf(
        DirectoryNotFoundError,
      );
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('writes Buffer content as Uint8Array', async () => {
      const { fs, mesaFs } = createFs();

      await fs.writeFile('/docs/file.bin', Buffer.from([1, 2, 3]));

      expect(mesaFs.writeFile).toHaveBeenCalledWith('/docs/file.bin', expect.any(Uint8Array));
    });

    it('honors overwrite=false with a preflight exists check', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockResolvedValueOnce(true);

      await expect(fs.writeFile('/docs/existing.txt', 'data', { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('does not treat arbitrary exists failures as missing for overwrite=false', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockRejectedValueOnce(new Error('network failed'));

      await expect(fs.writeFile('/docs/existing.txt', 'data', { overwrite: false })).rejects.toThrow(/network failed/);
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('honors expectedMtime with a preflight stat check', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ mtime: new Date('2025-06-02T00:00:00.000Z') }));

      await expect(
        fs.writeFile('/docs/existing.txt', 'data', { expectedMtime: new Date('2025-06-01T00:00:00.000Z') }),
      ).rejects.toBeInstanceOf(StaleFileError);
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('appends content through Mesa', async () => {
      const { fs, mesaFs } = createFs();

      await fs.appendFile('/docs/log.txt', 'line');

      expect(mesaFs.appendFile).toHaveBeenCalledWith('/docs/log.txt', 'line');
    });

    it('deletes files through Mesa rm', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: true, isDirectory: false }));

      await fs.deleteFile('/docs/file.txt');

      expect(mesaFs.rm).toHaveBeenCalledWith('/docs/file.txt', { force: undefined });
    });

    it('ignores missing deleteFile when force=true', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockRejectedValueOnce(notFound('/docs/missing.txt'));

      await fs.deleteFile('/docs/missing.txt', { force: true });

      expect(mesaFs.rm).not.toHaveBeenCalled();
    });

    it('copies files through Mesa cp', async () => {
      const { fs, mesaFs } = createFs();

      await fs.copyFile('/docs/a.txt', '/docs/b.txt', { recursive: true });

      expect(mesaFs.cp).toHaveBeenCalledWith('/docs/a.txt', '/docs/b.txt', { recursive: true });
    });

    it('moves files through Mesa mv', async () => {
      const { fs, mesaFs } = createFs();

      await fs.moveFile('/docs/a.txt', '/docs/b.txt');

      expect(mesaFs.mv).toHaveBeenCalledWith('/docs/a.txt', '/docs/b.txt');
    });
  });

  describe('directory and path operations', () => {
    it('creates directories through Mesa mkdir', async () => {
      const { fs, mesaFs } = createFs();

      await fs.mkdir('/docs/new');

      expect(mesaFs.mkdir).toHaveBeenCalledWith('/docs/new', { recursive: true });
    });

    it('removes directories through Mesa rm', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: false, isDirectory: true, size: 0 }));

      await fs.rmdir('/docs/old', { recursive: true, force: true });

      expect(mesaFs.rm).toHaveBeenCalledWith('/docs/old', { recursive: true, force: true });
    });

    it('removes empty directories without requiring recursive=true from callers', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: false, isDirectory: true, size: 0 }));
      mesaFs.readdirWithFileTypes.mockResolvedValueOnce([]);

      await fs.rmdir('/docs/empty');

      expect(mesaFs.readdirWithFileTypes).toHaveBeenCalledWith('/docs/empty');
      expect(mesaFs.rm).toHaveBeenCalledWith('/docs/empty', { recursive: true, force: undefined });
    });

    it('rejects non-empty directory removal without recursive=true', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: false, isDirectory: true, size: 0 }));
      mesaFs.readdirWithFileTypes.mockResolvedValueOnce([
        { name: 'file.txt', isFile: true, isDirectory: false, isSymbolicLink: false },
      ]);

      await expect(fs.rmdir('/docs/not-empty')).rejects.toBeInstanceOf(DirectoryNotEmptyError);
      expect(mesaFs.rm).not.toHaveBeenCalled();
    });

    it('lists direct children and filters extensions', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readdirWithFileTypes.mockResolvedValueOnce([
        { name: 'README.md', isFile: true, isDirectory: false, isSymbolicLink: false },
        { name: 'index.ts', isFile: true, isDirectory: false, isSymbolicLink: false },
        { name: 'src', isFile: false, isDirectory: true, isSymbolicLink: false },
      ]);

      const entries = await fs.readdir('/docs', { extension: '.ts' });

      expect(entries).toEqual([
        { name: 'index.ts', type: 'file', size: 5 },
        { name: 'src', type: 'directory' },
      ]);
    });

    it('lists recursively with relative child names', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readdirWithFileTypes
        .mockResolvedValueOnce([{ name: 'src', isFile: false, isDirectory: true, isSymbolicLink: false }])
        .mockResolvedValueOnce([{ name: 'index.ts', isFile: true, isDirectory: false, isSymbolicLink: false }]);

      const entries = await fs.readdir('/docs', { recursive: true });

      expect(entries).toEqual([
        { name: 'src', type: 'directory' },
        { name: 'src/index.ts', type: 'file', size: 5 },
      ]);
    });

    it('delegates exists and realpath', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockResolvedValueOnce(true);
      mesaFs.realpath.mockResolvedValueOnce('/docs/file.txt');

      await expect(fs.exists('docs/file.txt')).resolves.toBe(true);
      await expect(fs.realpath('docs/file.txt')).resolves.toBe('/docs/file.txt');
    });

    it('returns false when exists receives a Mesa not-found error', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockRejectedValueOnce(notFound('/docs/missing.txt'));

      await expect(fs.exists('/docs/missing.txt')).resolves.toBe(false);
    });

    it('maps stat results to Mastra FileStat', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ size: 12 }));

      await expect(fs.stat('/docs/file.txt')).resolves.toEqual({
        name: 'file.txt',
        path: '/docs/file.txt',
        type: 'file',
        size: 12,
        createdAt: new Date('2025-06-01T00:00:00.000Z'),
        modifiedAt: new Date('2025-06-01T00:00:00.000Z'),
      });
    });
  });

  describe('Mesa-specific operations', () => {
    it('exposes Mesa bash', async () => {
      const { fs, mesaFs } = createFs();

      const bash = await fs.bash({ cwd: '/docs' });

      expect(bash).toEqual({ kind: 'bash' });
      expect(mesaFs.bash).toHaveBeenCalledWith({ cwd: '/docs' });
    });

    it('exposes Mesa change and bookmark operations', async () => {
      const { fs, mesaFs } = createFs();

      await fs.readFile('/docs/README.md');

      expect(fs.change).toBe(mesaFs.change);
      expect(fs.bookmark).toBe(mesaFs.bookmark);
    });
  });

  describe('read-only mode', () => {
    it.each([
      ['writeFile', (fs: MesaFilesystem) => fs.writeFile('/docs/file.txt', 'data')],
      ['appendFile', (fs: MesaFilesystem) => fs.appendFile('/docs/file.txt', 'data')],
      ['deleteFile', (fs: MesaFilesystem) => fs.deleteFile('/docs/file.txt')],
      ['copyFile', (fs: MesaFilesystem) => fs.copyFile('/docs/file.txt', '/docs/copy.txt')],
      ['moveFile', (fs: MesaFilesystem) => fs.moveFile('/docs/file.txt', '/docs/moved.txt')],
      ['mkdir', (fs: MesaFilesystem) => fs.mkdir('/docs/new')],
      ['rmdir', (fs: MesaFilesystem) => fs.rmdir('/docs/old')],
    ])('blocks %s', async (_name, operation) => {
      const { fs } = createFs({ readOnly: true });

      await expect(operation(fs)).rejects.toBeInstanceOf(WorkspaceReadOnlyError);
    });
  });
});
