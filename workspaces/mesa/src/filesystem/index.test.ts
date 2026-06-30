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

const mesaSdkMock = vi.hoisted(() => ({
  Mesa: vi.fn(),
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
  mesaSdkMock.Mesa.mockImplementation(function (this: { fs: { mount: typeof mesaSdkMock.mount } }) {
    this.fs = { mount: mesaSdkMock.mount };
  });

  const fs = new MesaFilesystem({
    repos: [{ name: 'docs', bookmark: 'main' }],
    ...options,
  } as ConstructorParameters<typeof MesaFilesystem>[0]);

  return { fs, mesaFs };
}

describe('MesaFilesystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mesaSdkMock.filesystem = undefined;
    mesaSdkMock.mount.mockImplementation(async () => mesaSdkMock.filesystem);
    mesaSdkMock.Mesa.mockImplementation(function (this: { fs: { mount: typeof mesaSdkMock.mount } }) {
      this.fs = { mount: mesaSdkMock.mount };
    });
  });

  describe('constructor and metadata', () => {
    it('generates unique ids when not provided', () => {
      const fs1 = new MesaFilesystem({ repos: [{ name: 'docs', bookmark: 'main' }] });
      const fs2 = new MesaFilesystem({ repos: [{ name: 'docs', bookmark: 'main' }] });

      expect(fs1.id).toMatch(/^mesa-fs-/);
      expect(fs2.id).toMatch(/^mesa-fs-/);
      expect(fs1.id).not.toBe(fs2.id);
    });

    it('uses fixed display metadata', () => {
      const { fs } = createFs({
        readOnly: true,
        org: 'acme',
        repos: [{ name: 'docs', bookmark: 'main' }],
      });

      expect(fs.id).toMatch(/^mesa-fs-/);
      expect(fs.name).toBe('MesaFilesystem');
      expect(fs.provider).toBe('mesa');
      expect(fs.displayName).toBe('Mesa');
      expect(fs.icon).toBe('mesa');
      expect(fs.description).toBe('Versioned Mesa filesystem for workspace files');
      expect(fs.readOnly).toBe(true);
    });

    it('returns filesystem info without exposing credentials', () => {
      const { fs } = createFs({
        org: 'acme',
        repos: [{ name: 'docs', bookmark: 'main' }],
      });

      expect(fs.getInfo()).toEqual(
        expect.objectContaining({
          id: fs.id,
          name: 'MesaFilesystem',
          provider: 'mesa',
          icon: 'mesa',
          metadata: {
            org: 'acme',
            repos: ['docs'],
            mode: 'client',
          },
        }),
      );
    });

    it('builds instructions with org, repo, and read-only context', () => {
      const { fs } = createFs({
        readOnly: true,
        org: 'acme',
        repos: [{ name: 'docs', bookmark: 'main' }],
      });

      expect(fs.getInstructions()).toContain('Org: "acme"');
      expect(fs.getInstructions()).toContain('Mounted repos: "docs"');
      expect(fs.getInstructions()).toContain('Mounted read-only');
    });
  });

  describe('lifecycle', () => {
    it('creates and mounts a Mesa client during init', async () => {
      const { fs, mesaFs } = createFs();

      await fs.readFile('/acme/docs/README.md');

      expect(fs.filesystem).toBe(mesaFs);
      expect(fs.status).toBe('ready');
      expect(mesaSdkMock.Mesa).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: undefined,
          org: undefined,
        }),
      );
      expect(mesaSdkMock.mount).toHaveBeenCalledWith(
        expect.objectContaining({
          repos: [{ name: 'docs', bookmark: 'main' }],
        }),
      );
    });

    it('marks mounted repos read-only when provider readOnly is true', async () => {
      const { fs } = createFs({ readOnly: true });

      await fs.readFile('/acme/docs/README.md');

      expect(mesaSdkMock.mount).toHaveBeenCalledWith(
        expect.objectContaining({
          repos: [{ name: 'docs', bookmark: 'main', readOnly: true }],
        }),
      );
    });

    it('throws when mounting without repos', async () => {
      const fs = new MesaFilesystem({ repos: [] });

      await expect(fs.readFile('/acme/docs/README.md')).rejects.toThrow(/requires at least one repo/);
      expect(fs.status).toBe('error');
    });
  });

  describe('file operations', () => {
    it('reads Buffer content by default', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readFileBuffer.mockResolvedValueOnce(new Uint8Array([104, 105]));

      const result = await fs.readFile('acme/docs/hi.txt');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe('hi');
      expect(mesaFs.readFileBuffer).toHaveBeenCalledWith('/acme/docs/hi.txt');
    });

    it('returns encoded string content when requested', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readFileBuffer.mockResolvedValueOnce(new TextEncoder().encode('hello'));

      const result = await fs.readFile('/acme/docs/hello.txt', { encoding: 'utf-8' });

      expect(result).toBe('hello');
    });

    it('maps missing reads to FileNotFoundError', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readFileBuffer.mockRejectedValueOnce(notFound('/missing.txt'));

      await expect(fs.readFile('/missing.txt')).rejects.toBeInstanceOf(FileNotFoundError);
    });

    it('writes strings and creates parent directories by default', async () => {
      const { fs, mesaFs } = createFs();

      await fs.writeFile('/acme/docs/new/file.txt', 'hello');

      expect(mesaFs.mkdir).toHaveBeenCalledWith('/acme/docs/new', { recursive: true });
      expect(mesaFs.writeFile).toHaveBeenCalledWith('/acme/docs/new/file.txt', 'hello');
    });

    it('anchors relative paths before normalizing parent traversal', async () => {
      const { fs, mesaFs } = createFs();

      await fs.writeFile('../acme/docs/file.txt', 'hello');

      expect(mesaFs.mkdir).toHaveBeenCalledWith('/acme/docs', { recursive: true });
      expect(mesaFs.writeFile).toHaveBeenCalledWith('/acme/docs/file.txt', 'hello');
    });

    it('requires existing parent directory when recursive=false', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockRejectedValueOnce(notFound('/acme/docs/new'));

      await expect(fs.writeFile('/acme/docs/new/file.txt', 'hello', { recursive: false })).rejects.toBeInstanceOf(
        DirectoryNotFoundError,
      );
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('writes Buffer content as Uint8Array', async () => {
      const { fs, mesaFs } = createFs();

      await fs.writeFile('/acme/docs/file.bin', Buffer.from([1, 2, 3]));

      expect(mesaFs.writeFile).toHaveBeenCalledWith('/acme/docs/file.bin', expect.any(Uint8Array));
    });

    it('honors overwrite=false with a preflight exists check', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockResolvedValueOnce(true);

      await expect(fs.writeFile('/acme/docs/existing.txt', 'data', { overwrite: false })).rejects.toBeInstanceOf(
        FileExistsError,
      );
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('does not treat arbitrary exists failures as missing for overwrite=false', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockRejectedValueOnce(new Error('network failed'));

      await expect(fs.writeFile('/acme/docs/existing.txt', 'data', { overwrite: false })).rejects.toThrow(
        /network failed/,
      );
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('honors expectedMtime with a preflight stat check', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ mtime: new Date('2025-06-02T00:00:00.000Z') }));

      await expect(
        fs.writeFile('/acme/docs/existing.txt', 'data', { expectedMtime: new Date('2025-06-01T00:00:00.000Z') }),
      ).rejects.toBeInstanceOf(StaleFileError);
      expect(mesaFs.writeFile).not.toHaveBeenCalled();
    });

    it('appends content through Mesa', async () => {
      const { fs, mesaFs } = createFs();

      await fs.appendFile('/acme/docs/log.txt', 'line');

      expect(mesaFs.appendFile).toHaveBeenCalledWith('/acme/docs/log.txt', 'line');
    });

    it('deletes files through Mesa rm', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: true, isDirectory: false }));

      await fs.deleteFile('/acme/docs/file.txt');

      expect(mesaFs.rm).toHaveBeenCalledWith('/acme/docs/file.txt', { force: undefined });
    });

    it('ignores missing deleteFile when force=true', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockRejectedValueOnce(notFound('/acme/docs/missing.txt'));

      await fs.deleteFile('/acme/docs/missing.txt', { force: true });

      expect(mesaFs.rm).not.toHaveBeenCalled();
    });

    it('copies files through Mesa cp', async () => {
      const { fs, mesaFs } = createFs();

      await fs.copyFile('/acme/docs/a.txt', '/acme/docs/b.txt', { recursive: true });

      expect(mesaFs.cp).toHaveBeenCalledWith('/acme/docs/a.txt', '/acme/docs/b.txt', { recursive: true });
    });

    it('moves files through Mesa mv', async () => {
      const { fs, mesaFs } = createFs();

      await fs.moveFile('/acme/docs/a.txt', '/acme/docs/b.txt');

      expect(mesaFs.mv).toHaveBeenCalledWith('/acme/docs/a.txt', '/acme/docs/b.txt');
    });
  });

  describe('directory and path operations', () => {
    it('creates directories through Mesa mkdir', async () => {
      const { fs, mesaFs } = createFs();

      await fs.mkdir('/acme/docs/new');

      expect(mesaFs.mkdir).toHaveBeenCalledWith('/acme/docs/new', { recursive: true });
    });

    it('removes directories through Mesa rm', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: false, isDirectory: true, size: 0 }));

      await fs.rmdir('/acme/docs/old', { recursive: true, force: true });

      expect(mesaFs.rm).toHaveBeenCalledWith('/acme/docs/old', { recursive: true, force: true });
    });

    it('removes empty directories without requiring recursive=true from callers', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: false, isDirectory: true, size: 0 }));
      mesaFs.readdirWithFileTypes.mockResolvedValueOnce([]);

      await fs.rmdir('/acme/docs/empty');

      expect(mesaFs.readdirWithFileTypes).toHaveBeenCalledWith('/acme/docs/empty');
      expect(mesaFs.rm).toHaveBeenCalledWith('/acme/docs/empty', { recursive: true, force: undefined });
    });

    it('rejects non-empty directory removal without recursive=true', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ isFile: false, isDirectory: true, size: 0 }));
      mesaFs.readdirWithFileTypes.mockResolvedValueOnce([
        { name: 'file.txt', isFile: true, isDirectory: false, isSymbolicLink: false },
      ]);

      await expect(fs.rmdir('/acme/docs/not-empty')).rejects.toBeInstanceOf(DirectoryNotEmptyError);
      expect(mesaFs.rm).not.toHaveBeenCalled();
    });

    it('lists direct children and filters extensions', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.readdirWithFileTypes.mockResolvedValueOnce([
        { name: 'README.md', isFile: true, isDirectory: false, isSymbolicLink: false },
        { name: 'index.ts', isFile: true, isDirectory: false, isSymbolicLink: false },
        { name: 'src', isFile: false, isDirectory: true, isSymbolicLink: false },
      ]);

      const entries = await fs.readdir('/acme/docs', { extension: '.ts' });

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

      const entries = await fs.readdir('/acme/docs', { recursive: true });

      expect(entries).toEqual([
        { name: 'src', type: 'directory' },
        { name: 'src/index.ts', type: 'file', size: 5 },
      ]);
    });

    it('delegates exists and realpath', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockResolvedValueOnce(true);
      mesaFs.realpath.mockResolvedValueOnce('/acme/docs/file.txt');

      await expect(fs.exists('acme/docs/file.txt')).resolves.toBe(true);
      await expect(fs.realpath('acme/docs/file.txt')).resolves.toBe('/acme/docs/file.txt');
    });

    it('returns false when exists receives a Mesa not-found error', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.exists.mockRejectedValueOnce(notFound('/acme/docs/missing.txt'));

      await expect(fs.exists('/acme/docs/missing.txt')).resolves.toBe(false);
    });

    it('maps stat results to Mastra FileStat', async () => {
      const { fs, mesaFs } = createFs();
      mesaFs.stat.mockResolvedValueOnce(createStat({ size: 12 }));

      await expect(fs.stat('/acme/docs/file.txt')).resolves.toEqual({
        name: 'file.txt',
        path: '/acme/docs/file.txt',
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

      const bash = await fs.bash({ cwd: '/acme/docs' });

      expect(bash).toEqual({ kind: 'bash' });
      expect(mesaFs.bash).toHaveBeenCalledWith({ cwd: '/acme/docs' });
    });

    it('exposes Mesa change and bookmark operations', async () => {
      const { fs, mesaFs } = createFs();

      await fs.readFile('/acme/docs/README.md');

      expect(fs.change).toBe(mesaFs.change);
      expect(fs.bookmark).toBe(mesaFs.bookmark);
    });
  });

  describe('read-only mode', () => {
    it.each([
      ['writeFile', (fs: MesaFilesystem) => fs.writeFile('/acme/docs/file.txt', 'data')],
      ['appendFile', (fs: MesaFilesystem) => fs.appendFile('/acme/docs/file.txt', 'data')],
      ['deleteFile', (fs: MesaFilesystem) => fs.deleteFile('/acme/docs/file.txt')],
      ['copyFile', (fs: MesaFilesystem) => fs.copyFile('/acme/docs/file.txt', '/acme/docs/copy.txt')],
      ['moveFile', (fs: MesaFilesystem) => fs.moveFile('/acme/docs/file.txt', '/acme/docs/moved.txt')],
      ['mkdir', (fs: MesaFilesystem) => fs.mkdir('/acme/docs/new')],
      ['rmdir', (fs: MesaFilesystem) => fs.rmdir('/acme/docs/old')],
    ])('blocks %s', async (_name, operation) => {
      const { fs } = createFs({ readOnly: true });

      await expect(operation(fs)).rejects.toBeInstanceOf(WorkspaceReadOnlyError);
    });
  });
});
