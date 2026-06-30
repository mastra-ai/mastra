import path from 'node:path/posix';

import { createFilesystemTestSuite } from '@internal/workspace-test-utils';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FilesystemIcon,
  FilesystemInfo,
  FileStat,
  ListOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WorkspaceFilesystem,
  WriteOptions,
} from '@mastra/core/workspace';
import { Mesa } from '@mesadev/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MesaFilesystem } from './index';

interface MesaTestEnv {
  apiKey: string;
  org: string;
  repo: string;
  mesa: Mesa;
}

let mesaTestEnv: MesaTestEnv | undefined;
const hasMesaApiKey = Boolean(process.env.MESA_API_KEY);
const describeWithMesaApiKey = hasMesaApiKey ? describe : describe.skip;

function createTestRepoName(): string {
  return `mastra-test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isNotFoundError(error: unknown): boolean {
  const err =
    error && typeof error === 'object' ? (error as { code?: unknown; name?: unknown; message?: unknown }) : undefined;
  const code = typeof err?.code === 'string' ? err.code : undefined;
  const name = typeof err?.name === 'string' ? err.name : undefined;
  const message =
    typeof err?.message === 'string' ? err.message : error instanceof Error ? error.message : String(error);

  return (
    code === 'ENOENT' ||
    code === 'NotFound' ||
    name === 'ENOENT' ||
    name === 'NotFound' ||
    /\b(no such|not found|enoent)\b/i.test(message)
  );
}

if (hasMesaApiKey) {
  beforeAll(async () => {
    const apiKey = process.env.MESA_API_KEY!;
    const mesa = new Mesa({ apiKey });
    const org = await mesa.resolveOrg();
    const repo = createTestRepoName();

    await mesa.repos.create({ name: repo });

    mesaTestEnv = {
      apiKey,
      org,
      repo,
      mesa,
    };
  });
}

function getMesaTestEnv(): MesaTestEnv {
  if (!mesaTestEnv) {
    throw new Error('MesaFilesystem integration test environment was not initialized.');
  }

  return mesaTestEnv;
}

async function deleteMesaTestRepo(): Promise<void> {
  if (!mesaTestEnv) return;

  try {
    await mesaTestEnv.mesa.repos.delete({ repo: mesaTestEnv.repo });
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
}

afterAll(async () => {
  await deleteMesaTestRepo();
});

function mesaRepoPath(...parts: string[]): string {
  const env = getMesaTestEnv();
  return path.join('/', env.org, env.repo, ...parts);
}

function createMesaFilesystem(): MesaFilesystem {
  const env = getMesaTestEnv();

  return new MesaFilesystem({
    apiKey: env.apiKey,
    repos: [
      {
        name: env.repo,
        bookmark: 'main',
      },
    ],
  });
}

class RootedMesaFilesystem implements WorkspaceFilesystem {
  constructor(
    private readonly filesystem: MesaFilesystem,
    private readonly root: string,
  ) {}

  get id(): string {
    return this.filesystem.id;
  }

  get name(): string {
    return this.filesystem.name;
  }

  get provider(): string {
    return this.filesystem.provider;
  }

  get status(): ProviderStatus {
    return this.filesystem.status;
  }

  get error(): string | undefined {
    return this.filesystem.error;
  }

  get readOnly(): boolean | undefined {
    return this.filesystem.readOnly;
  }

  get icon(): FilesystemIcon | undefined {
    return this.filesystem.icon;
  }

  get displayName(): string | undefined {
    return this.filesystem.displayName;
  }

  get description(): string | undefined {
    return this.filesystem.description;
  }

  async init(): Promise<void> {
    await this.filesystem._init();
    await this.filesystem.mkdir(this.root, { recursive: true });
  }

  async destroy(): Promise<void> {
    await this.filesystem._destroy();
  }

  getInfo(): FilesystemInfo {
    return {
      ...this.filesystem.getInfo(),
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
    };
  }

  getInstructions(): string {
    return this.filesystem.getInstructions();
  }

  async realpath(inputPath: string): Promise<string> {
    const resolved = await this.filesystem.realpath(this.toMesaPath(inputPath));
    return this.fromMesaPath(resolved);
  }

  readFile(inputPath: string, options?: ReadOptions): Promise<string | Buffer> {
    return this.filesystem.readFile(this.toMesaPath(inputPath), options);
  }

  writeFile(inputPath: string, content: FileContent, options?: WriteOptions): Promise<void> {
    return this.filesystem.writeFile(this.toMesaPath(inputPath), content, options);
  }

  appendFile(inputPath: string, content: FileContent): Promise<void> {
    return this.filesystem.appendFile(this.toMesaPath(inputPath), content);
  }

  deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
    return this.filesystem.deleteFile(this.toMesaPath(inputPath), options);
  }

  copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    return this.filesystem.copyFile(this.toMesaPath(src), this.toMesaPath(dest), options);
  }

  moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    return this.filesystem.moveFile(this.toMesaPath(src), this.toMesaPath(dest), options);
  }

  mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    return this.filesystem.mkdir(this.toMesaPath(inputPath), options);
  }

  rmdir(inputPath: string, options?: RemoveOptions): Promise<void> {
    return this.filesystem.rmdir(this.toMesaPath(inputPath), options);
  }

  readdir(inputPath: string, options?: ListOptions): Promise<FileEntry[]> {
    return this.filesystem.readdir(this.toMesaPath(inputPath), options);
  }

  exists(inputPath: string): Promise<boolean> {
    return this.filesystem.exists(this.toMesaPath(inputPath));
  }

  async stat(inputPath: string): Promise<FileStat> {
    const stat = await this.filesystem.stat(this.toMesaPath(inputPath));
    return { ...stat, path: this.fromMesaPath(stat.path) };
  }

  private toMesaPath(inputPath: string): string {
    const normalized = path.normalize(inputPath || '/');
    const relativePath = normalized === '/' ? '' : normalized.replace(/^\/+/, '');
    const resolved = path.resolve(this.root, relativePath);

    if (resolved !== this.root && !resolved.startsWith(`${this.root}/`)) {
      throw new Error(`Path escapes Mesa conformance test root: ${inputPath}`);
    }

    return resolved;
  }

  private fromMesaPath(inputPath: string): string {
    const normalized = path.normalize(inputPath);
    if (normalized === this.root) return '/';
    if (normalized.startsWith(`${this.root}/`)) return normalized.slice(this.root.length);
    throw new Error(`Mesa path escapes conformance test root: ${inputPath}`);
  }
}

describeWithMesaApiKey('MesaFilesystem integration', () => {
  it('creates an isolated Mesa repo for the test run', () => {
    const env = getMesaTestEnv();

    expect(env.org).toBeTruthy();
    expect(env.repo).toMatch(/^mastra-test-/);
  });

  it('performs basic file operations against a Mesa repo', async () => {
    const testDir = mesaRepoPath(`smoke-${Date.now()}`);
    const fs = createMesaFilesystem();

    try {
      await fs.writeFile(`${testDir}/hello.txt`, 'hello');
      await expect(fs.readFile(`${testDir}/hello.txt`, { encoding: 'utf-8' })).resolves.toBe('hello');

      await fs.copyFile(`${testDir}/hello.txt`, `${testDir}/copy.txt`);
      await expect(fs.exists(`${testDir}/copy.txt`)).resolves.toBe(true);

      await fs.moveFile(`${testDir}/copy.txt`, `${testDir}/moved.txt`);
      await expect(fs.exists(`${testDir}/moved.txt`)).resolves.toBe(true);

      const entries = await fs.readdir(testDir);
      expect(entries.map(entry => entry.name).sort()).toEqual(['hello.txt', 'moved.txt']);
    } finally {
      await fs.rmdir(testDir, { recursive: true, force: true });
    }
  });

  it('reports Mesa path stats without assuming local runner timestamps', async () => {
    const testDir = mesaRepoPath(`path-${Date.now()}`);
    const fs = createMesaFilesystem();

    try {
      await fs.writeFile(`${testDir}/stat-time.txt`, 'content');

      await expect(fs.exists(`${testDir}/stat-time.txt`)).resolves.toBe(true);

      const stat = await fs.stat(`${testDir}/stat-time.txt`);
      expect(stat).toEqual(
        expect.objectContaining({
          name: 'stat-time.txt',
          path: `${testDir}/stat-time.txt`,
          type: 'file',
          size: expect.any(Number),
          createdAt: expect.any(Date),
          modifiedAt: expect.any(Date),
        }),
      );
    } finally {
      await fs.rmdir(testDir, { recursive: true, force: true });
    }
  });
});

if (hasMesaApiKey) {
  createFilesystemTestSuite({
    suiteName: 'MesaFilesystem Conformance',
    createFilesystem: async () => {
      const testRoot = mesaRepoPath(`conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return new RootedMesaFilesystem(createMesaFilesystem(), testRoot);
    },
    capabilities: {
      supportsAppend: true,
      supportsBinaryFiles: true,
      supportsMounting: false,
      supportsForceDelete: true,
      supportsOverwrite: true,
      supportsConcurrency: true,
      supportsEmptyDirectories: true,
      deleteThrowsOnMissing: true,
    },
    testDomains: {
      // Mesa returns server-side mtimes, but the shared pathOperations suite
      // assumes stat().modifiedAt is comparable to the local test runner clock.
      pathOperations: false,
    },
    testTimeout: 30000,
  });
} else {
  describe.skip('MesaFilesystem Conformance', () => {
    it('requires MESA_API_KEY', () => {});
  });
}
