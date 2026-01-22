/**
 * E2B Filesystem Provider
 *
 * A filesystem implementation that uses E2B sandbox's internal filesystem.
 * This is useful when you want the workspace filesystem to be the sandbox's FS.
 *
 * Note: For mounting external filesystems INTO E2B, use the mount() method
 * on E2BSandbox instead. This class is for when you want E2B's internal FS
 * as the primary workspace filesystem.
 *
 * Note: Requires @e2b/code-interpreter as a peer dependency.
 */

import type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';
import { FileNotFoundError, DirectoryNotFoundError, IsDirectoryError, NotDirectoryError } from './filesystem';
import type { E2BSandbox } from './e2b-sandbox';

// E2B Sandbox type - imported dynamically to avoid hard dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type E2BSandboxInstance = any;

// =============================================================================
// E2B Filesystem Options
// =============================================================================

/**
 * E2B filesystem provider configuration.
 */
export interface E2BFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** E2BSandbox instance to share - filesystem operations use its sandbox */
  sandbox?: E2BSandbox;
}

// =============================================================================
// E2B Filesystem Implementation
// =============================================================================

/**
 * E2B filesystem implementation.
 *
 * Uses E2B sandbox's files API for cloud-based file storage.
 * Shares the sandbox instance with E2BSandbox for unified operations.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BSandbox, E2BFilesystem } from '@mastra/core/workspace';
 *
 * const e2bSandbox = new E2BSandbox({ timeout: 60000 });
 * const workspace = new Workspace({
 *   filesystem: new E2BFilesystem({ sandbox: e2bSandbox }),
 *   sandbox: e2bSandbox,
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/hello.txt', 'Hello from E2B!');
 * ```
 */
export class E2BFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'E2BFilesystem';
  readonly provider = 'e2b';

  /**
   * E2BFilesystem doesn't support mounting - it IS the sandbox filesystem.
   */
  readonly supportsMounting = false;

  private _sandbox: E2BSandbox | null = null;

  constructor(options: E2BFilesystemOptions = {}) {
    this.id = options.id ?? `e2b-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (options.sandbox) {
      this._sandbox = options.sandbox;
    }
  }

  /**
   * Set the E2B sandbox to use for filesystem operations.
   * This allows late binding when the sandbox isn't available at construction time.
   */
  setSandbox(sandbox: E2BSandbox): void {
    this._sandbox = sandbox;
  }

  private async getSandbox(): Promise<E2BSandboxInstance> {
    if (!this._sandbox) {
      throw new Error('E2BFilesystem: No sandbox configured. Pass sandbox in options or call setSandbox().');
    }

    // Ensure sandbox is started
    if (!(await this._sandbox.isReady())) {
      await this._sandbox.start();
    }

    // Access internal sandbox - this is a bit hacky but necessary
    // In a real implementation, E2BSandbox would expose a getter
    const sandbox = await this.getInternalSandbox();
    if (!sandbox) {
      throw new Error('E2BFilesystem: Sandbox not ready');
    }
    return sandbox;
  }

  private async getInternalSandbox(): Promise<E2BSandboxInstance | null> {
    // Use the sandbox's readFile to test if it's ready and get access
    // This is a workaround - ideally E2BSandbox would expose the internal sandbox
    if (!this._sandbox) return null;

    try {
      // Try to use the sandbox's filesystem method
      await this._sandbox.listFiles('/');
      // If successful, we know the sandbox is ready
      // Return a proxy object that delegates to the E2BSandbox methods
      return this.createSandboxProxy();
    } catch {
      return null;
    }
  }

  /**
   * Create a proxy that wraps E2BSandbox to provide the Sandbox interface we need.
   */
  private createSandboxProxy(): E2BSandboxInstance {
    const sandbox = this._sandbox!;

    // Create a minimal Sandbox-like object that delegates to E2BSandbox
    return {
      files: {
        read: (path: string) => sandbox.readFile(path),
        write: (path: string, content: string) => sandbox.writeFile(path, content),
        list: async (path: string) => {
          const names = await sandbox.listFiles(path);
          // E2B list returns objects with name and type
          return names.map(name => ({ name, type: 'file' as const }));
        },
        remove: async (path: string) => {
          const result = await sandbox.executeCommand(`rm -f "${path}"`);
          if (result.exitCode !== 0) {
            throw new Error(`Failed to remove: ${result.stderr}`);
          }
        },
      },
      commands: {
        run: async (command: string, options?: { cwd?: string; envs?: Record<string, string>; timeoutMs?: number }) => {
          const result = await sandbox.executeCommand(command, [], {
            cwd: options?.cwd,
            env: options?.envs,
            timeout: options?.timeoutMs,
          });
          return {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          };
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const sandbox = await this.getSandbox();
    try {
      const content = await sandbox.files.read(path);
      if (options?.encoding) {
        return content;
      }
      return Buffer.from(content, 'utf-8');
    } catch (error) {
      // Check if it's a directory
      const isDir = await this.isDirectory(path);
      if (isDir) {
        throw new IsDirectoryError(path);
      }
      throw new FileNotFoundError(path);
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const sandbox = await this.getSandbox();

    if (options?.recursive !== false) {
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        await this.mkdir(dir, { recursive: true });
      }
    }

    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');
    await sandbox.files.write(path, contentStr);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const sandbox = await this.getSandbox();
    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');

    try {
      const existing = await sandbox.files.read(path);
      await sandbox.files.write(path, existing + contentStr);
    } catch {
      // File doesn't exist, create it
      await sandbox.files.write(path, contentStr);
    }
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const sandbox = await this.getSandbox();
    try {
      await sandbox.files.remove(path);
    } catch (error) {
      if (!options?.force) throw new FileNotFoundError(path);
    }
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const sandbox = await this.getSandbox();
    const result = await sandbox.commands.run(`cp "${src}" "${dest}"`);
    if (result.exitCode !== 0) {
      throw new FileNotFoundError(src);
    }
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const sandbox = await this.getSandbox();
    const result = await sandbox.commands.run(`mv "${src}" "${dest}"`);
    if (result.exitCode !== 0) {
      throw new FileNotFoundError(src);
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const sandbox = await this.getSandbox();
    const flags = options?.recursive ? '-p' : '';
    const result = await sandbox.commands.run(`mkdir ${flags} "${path}"`);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create directory: ${result.stderr}`);
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const sandbox = await this.getSandbox();
    const flags = options?.recursive ? '-rf' : '-r';
    const result = await sandbox.commands.run(`rm ${flags} "${path}"`);
    if (result.exitCode !== 0 && !options?.force) {
      throw new DirectoryNotFoundError(path);
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const sandbox = await this.getSandbox();

    // Check if path is a directory first
    const isDir = await this.isDirectory(path);
    if (!isDir) {
      const exists = await this.exists(path);
      if (exists) {
        throw new NotDirectoryError(path);
      }
      throw new DirectoryNotFoundError(path);
    }

    if (!options?.recursive) {
      const entries = await sandbox.files.list(path);
      let fileEntries: FileEntry[] = entries.map((e: { name: string; type: string }) => ({
        name: e.name,
        type: e.type === 'dir' ? 'directory' : 'file',
        size: undefined,
      }));

      if (options?.extension) {
        const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
        fileEntries = fileEntries.filter(entry => {
          if (entry.type === 'directory') return true;
          return extensions.some(ext => entry.name.endsWith(ext));
        });
      }

      return fileEntries;
    }

    // Use ls for recursive listing
    const result = await sandbox.commands.run(`ls -laR "${path}"`);
    if (result.exitCode !== 0) {
      throw new DirectoryNotFoundError(path);
    }

    const lines = result.stdout.split('\n').filter((line: string) => line.trim() && !line.startsWith('total'));
    const entries: FileEntry[] = [];

    for (const line of lines) {
      if (line.endsWith(':')) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const permissions = parts[0];
      const size = parseInt(parts[4], 10);
      const name = parts.slice(8).join(' ');

      if (name === '.' || name === '..') continue;

      const isDirectory = permissions?.startsWith('d');
      entries.push({
        name,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : size,
      });
    }

    if (options?.extension) {
      const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
      return entries.filter(entry => {
        if (entry.type === 'directory') return true;
        return extensions.some(ext => entry.name.endsWith(ext));
      });
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const sandbox = await this.getSandbox();
    const result = await sandbox.commands.run(`test -e "${path}" && echo "exists" || echo "not found"`);
    return result.stdout.trim() === 'exists';
  }

  async stat(path: string): Promise<FileStat> {
    const sandbox = await this.getSandbox();

    const result = await sandbox.commands.run(
      `stat -c '%n|%F|%s|%Y|%W' "${path}" 2>/dev/null || stat -f '%N|%HT|%z|%m|%B' "${path}"`,
    );

    if (result.exitCode !== 0) {
      throw new FileNotFoundError(path);
    }

    const parts = result.stdout.trim().split('|');
    const name = parts[0]?.split('/').pop() ?? '';
    const typeStr = parts[1]?.toLowerCase() ?? '';
    const size = parseInt(parts[2] ?? '0', 10);
    const mtime = parseInt(parts[3] ?? '0', 10) * 1000;
    const ctime = parseInt(parts[4] ?? '0', 10) * 1000;

    const isDir = typeStr.includes('directory');

    return {
      name,
      path,
      type: isDir ? 'directory' : 'file',
      size: isDir ? 0 : size,
      createdAt: new Date(ctime || mtime),
      modifiedAt: new Date(mtime),
    };
  }

  async isFile(path: string): Promise<boolean> {
    const sandbox = await this.getSandbox();
    const result = await sandbox.commands.run(`test -f "${path}" && echo "true" || echo "false"`);
    return result.stdout.trim() === 'true';
  }

  async isDirectory(path: string): Promise<boolean> {
    const sandbox = await this.getSandbox();
    const result = await sandbox.commands.run(`test -d "${path}" && echo "true" || echo "false"`);
    return result.stdout.trim() === 'true';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Ensure sandbox is started
    if (this._sandbox && !(await this._sandbox.isReady())) {
      await this._sandbox.start();
    }
  }

  async destroy(): Promise<void> {
    // Don't destroy the sandbox - it's shared or managed externally
    this._sandbox = null;
  }
}
