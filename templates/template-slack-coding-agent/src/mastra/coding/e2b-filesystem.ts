/**
 * E2BFilesystem — MastraFilesystem backed by E2B sandbox file operations.
 *
 * Uses sandbox.e2b.files (the raw E2B SDK) for all file I/O, giving the agent
 * proper read_file / write_file / list_files / grep tools via the workspace.
 */

import { MastraFilesystem } from '@mastra/core/workspace';
import type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from '@mastra/core/workspace';
import type { ProviderStatus } from '@mastra/core/workspace';
import type { E2BSandbox } from '@mastra/e2b';

export class E2BFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'E2BFilesystem';
  readonly provider = 'e2b';
  status: ProviderStatus = 'pending';

  private readonly sandbox: E2BSandbox;

  constructor(sandbox: E2BSandbox) {
    super({ name: 'E2BFilesystem' });
    this.id = `e2b-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.sandbox = sandbox;
  }

  private get files() {
    return this.sandbox.e2b.files;
  }

  // Lifecycle
  async init(): Promise<void> {
    // The E2B sandbox handles its own lifecycle — nothing extra needed here.
  }

  async destroy(): Promise<void> {
    // Sandbox cleanup is handled by E2BSandbox.stop()
  }

  // File Operations

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    if (options?.encoding) {
      return await this.files.read(path, { format: 'text' });
    }
    const bytes = await this.files.read(path, { format: 'bytes' });
    return Buffer.from(bytes);
  }

  async writeFile(path: string, content: FileContent, _options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    const data = typeof content === 'string' ? content : Buffer.from(content).toString();
    await this.files.write(path, data);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    await this.ensureReady();
    // E2B doesn't have native append — read + write
    let existing = '';
    try {
      existing = await this.files.read(path, { format: 'text' });
    } catch {
      // File doesn't exist yet — that's fine
    }
    const appendData = typeof content === 'string' ? content : Buffer.from(content).toString();
    await this.files.write(path, existing + appendData);
  }

  async deleteFile(path: string, _options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    await this.files.remove(path);
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    const content = await this.files.read(src, { format: 'bytes' });
    await this.files.write(dest, content);
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    await this.files.rename(src, dest);
  }

  // Directory Operations

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    await this.files.makeDir(path);
  }

  async rmdir(path: string, _options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    await this.files.remove(path);
  }

  async readdir(path: string, _options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();
    const entries = await this.files.list(path);
    return entries.map(e => ({
      name: e.name,
      type: e.type === 'dir' ? 'directory' as const : 'file' as const,
      size: e.size,
      isSymlink: !!e.symlinkTarget,
      symlinkTarget: e.symlinkTarget,
    }));
  }

  // Path Operations

  async exists(path: string): Promise<boolean> {
    await this.ensureReady();
    return await this.files.exists(path);
  }

  async stat(path: string): Promise<FileStat> {
    await this.ensureReady();
    const info = await this.files.getInfo(path);
    return {
      name: info.name,
      path: info.path,
      type: info.type === 'dir' ? 'directory' : 'file',
      size: info.size,
      createdAt: info.modifiedTime ?? new Date(),
      modifiedAt: info.modifiedTime ?? new Date(),
    };
  }
}
