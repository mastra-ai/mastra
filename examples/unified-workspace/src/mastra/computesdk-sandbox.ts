/**
 * ComputeSDK Sandbox Provider
 *
 * A sandbox implementation that uses ComputeSDK for cloud-based code execution.
 * Supports multiple providers (E2B, Modal, etc.) through ComputeSDK's unified API.
 *
 * @see https://www.computesdk.com/docs/reference/computesandbox
 */

import { compute, type Sandbox } from 'computesdk';
import type {
  WorkspaceSandbox,
  WorkspaceFilesystem,
  SandboxStatus,
  SandboxRuntime,
  SandboxInfo,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  CodeResult,
  CommandResult,
  InstallPackageOptions,
  InstallPackageResult,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from '@mastra/core/workspace';

/**
 * ComputeSDK sandbox provider configuration.
 */
export interface ComputeSDKSandboxOptions {
  /** Pass an existing ComputeSDK sandbox instance (shared mode) */
  sandbox?: Sandbox;
  /** Unique identifier for this sandbox instance */
  id?: string;
  /** Named sandbox for persistence across restarts */
  name?: string;
  /** Namespace for sandbox isolation (default: "default") */
  namespace?: string;
  /** Execution timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Provider-specific template ID */
  templateId?: string;
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Supported runtimes (default: ['node', 'python', 'bash']) */
  runtimes?: SandboxRuntime[];
}

/**
 * ComputeSDK sandbox implementation.
 *
 * Uses ComputeSDK to execute code in cloud-based sandboxes.
 * Supports multiple providers through ComputeSDK's unified API.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
 * import { ComputeSDKSandbox } from './computesdk-sandbox';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 *   sandbox: new ComputeSDKSandbox({
 *     name: 'my-sandbox',
 *     timeout: 60000,
 *   }),
 * });
 *
 * await workspace.init();
 * const result = await workspace.executeCode('console.log("Hello!")', { runtime: 'node' });
 * ```
 */
export class ComputeSDKSandbox implements WorkspaceSandbox {
  readonly id: string;
  readonly name = 'ComputeSDKSandbox';
  readonly provider = 'computesdk';

  private _status: SandboxStatus = 'stopped';
  private _sandbox: Sandbox | null = null;
  private _isSharedSandbox: boolean = false;

  private readonly sandboxName?: string;
  private readonly namespace: string;
  private readonly timeout: number;
  private readonly templateId?: string;
  private readonly env: Record<string, string>;
  private readonly metadata: Record<string, unknown>;
  private readonly configuredRuntimes: SandboxRuntime[];

  constructor(options: ComputeSDKSandboxOptions = {}) {
    this.id = options.id ?? this.generateId();
    this.sandboxName = options.name;
    this.namespace = options.namespace ?? 'default';
    this.timeout = options.timeout ?? 30000;
    this.templateId = options.templateId;
    this.env = options.env ?? {};
    this.metadata = options.metadata ?? {};
    this.configuredRuntimes = options.runtimes ?? ['node', 'python', 'bash'];

    // If a sandbox instance is passed, use it directly (shared mode)
    if (options.sandbox) {
      this._sandbox = options.sandbox;
      this._status = 'running';
      this._isSharedSandbox = true;
    }
  }

  /**
   * Get the underlying ComputeSDK sandbox instance.
   * Useful for sharing with ComputeSDKFilesystem.
   */
  get sandbox(): Sandbox | null {
    return this._sandbox;
  }

  private generateId(): string {
    return `computesdk-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.configuredRuntimes[0] ?? 'node';
  }

  async start(): Promise<void> {
    // If we already have a sandbox (shared mode), just mark as running
    if (this._sandbox) {
      this._status = 'running';
      return;
    }

    this._status = 'starting';

    try {
      // Use findOrCreate if we have a name (enables persistence)
      if (this.sandboxName) {
        this._sandbox = await compute.sandbox.findOrCreate({
          name: this.sandboxName,
          namespace: this.namespace,
          timeout: this.timeout,
          envs: this.env,
          metadata: this.metadata,
        });
      } else {
        this._sandbox = await compute.sandbox.create({
          timeout: this.timeout,
          envs: this.env,
          metadata: this.metadata,
        });
      }

      this._status = 'running';
    } catch (error) {
      this._status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    // ComputeSDK sandboxes don't have a stop state - they're either running or destroyed
    // For named sandboxes, we just disconnect without destroying
    this._sandbox = null;
    this._status = 'stopped';
  }

  async destroy(): Promise<void> {
    if (this._sandbox) {
      // Don't destroy shared sandboxes - just disconnect
      if (!this._isSharedSandbox) {
        try {
          await this._sandbox.destroy();
        } catch {
          // Ignore errors during destroy
        }
      }
    }
    this._sandbox = null;
    this._status = 'destroyed';
  }

  async isReady(): Promise<boolean> {
    return this._status === 'running' && this._sandbox !== null;
  }

  async getInfo(): Promise<SandboxInfo> {
    if (!this._sandbox) {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this._status,
        createdAt: new Date(),
        metadata: {
          sandboxName: this.sandboxName,
          namespace: this.namespace,
        },
      };
    }

    try {
      const info = await this._sandbox.getInfo();
      return {
        id: info.id,
        name: this.name,
        provider: info.provider,
        status: this._status,
        createdAt: info.createdAt,
        timeoutAt: info.timeout ? new Date(Date.now() + info.timeout) : undefined,
        metadata: {
          ...info.metadata,
          sandboxName: this.sandboxName,
          namespace: this.namespace,
          runtime: info.runtime,
        },
      };
    } catch {
      return {
        id: this.id,
        name: this.name,
        provider: this.provider,
        status: this._status,
        createdAt: new Date(),
      };
    }
  }

  async executeCode(code: string, options: ExecuteCodeOptions = {}): Promise<CodeResult> {
    // Lazy initialization - start sandbox if not running
    if (this._status !== 'running' || !this._sandbox) {
      await this.start();
    }

    if (!this._sandbox) {
      throw new Error(`Sandbox failed to start: ${this.id}`);
    }

    const runtime = options.runtime ?? this.defaultRuntime;

    if (!this.supportedRuntimes.includes(runtime)) {
      throw new Error(`Runtime '${runtime}' is not supported. Supported: ${this.supportedRuntimes.join(', ')}`);
    }

    const startTime = Date.now();

    try {
      // Map our runtime names to ComputeSDK language names
      const language = this.mapRuntimeToLanguage(runtime) as 'python' | 'node' | undefined;

      const result = await this._sandbox.runCode(code, language);

      return {
        success: result.exitCode === 0,
        stdout: result.output,
        stderr: '',
        exitCode: result.exitCode,
        executionTimeMs: Date.now() - startTime,
        runtime,
      };
    } catch (error: unknown) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        executionTimeMs: Date.now() - startTime,
        runtime,
      };
    }
  }

  private mapRuntimeToLanguage(runtime: SandboxRuntime): string {
    switch (runtime) {
      case 'node':
        return 'node';
      case 'python':
        return 'python';
      case 'bash':
      case 'shell':
        return 'bash';
      case 'deno':
        return 'deno';
      case 'bun':
        return 'bun';
      default:
        return runtime;
    }
  }

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
  ): Promise<CommandResult> {
    // Lazy initialization - start sandbox if not running
    if (this._status !== 'running' || !this._sandbox) {
      await this.start();
    }

    if (!this._sandbox) {
      throw new Error(`Sandbox failed to start: ${this.id}`);
    }

    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    try {
      const result = await this._sandbox.runCommand(fullCommand, {
        cwd: options.cwd,
        env: options.env,
      });

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: result.durationMs ?? Date.now() - startTime,
        command,
        args,
      };
    } catch (error: unknown) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        executionTimeMs: Date.now() - startTime,
        command,
        args,
      };
    }
  }

  async installPackage(packageName: string, options: InstallPackageOptions = {}): Promise<InstallPackageResult> {
    const manager = options.packageManager ?? 'npm';
    const startTime = Date.now();

    let command: string;

    switch (manager) {
      case 'npm':
        command = options.global ? `npm install -g ${packageName}` : `npm install ${packageName}`;
        if (options.version) command = command.replace(packageName, `${packageName}@${options.version}`);
        break;
      case 'yarn':
        command = options.global ? `yarn global add ${packageName}` : `yarn add ${packageName}`;
        if (options.version) command = command.replace(packageName, `${packageName}@${options.version}`);
        break;
      case 'pnpm':
        command = options.global ? `pnpm add -g ${packageName}` : `pnpm add ${packageName}`;
        if (options.version) command = command.replace(packageName, `${packageName}@${options.version}`);
        break;
      case 'pip':
        command = `pip install ${packageName}`;
        if (options.version) command = `pip install ${packageName}==${options.version}`;
        break;
      default:
        return {
          success: false,
          packageName,
          error: `Unsupported package manager: ${manager}`,
          executionTimeMs: Date.now() - startTime,
        };
    }

    const result = await this.executeCommand(command, [], {
      timeout: options.timeout ?? 120000,
    });

    if (result.success) {
      return {
        success: true,
        packageName,
        version: options.version,
        executionTimeMs: result.executionTimeMs,
      };
    } else {
      return {
        success: false,
        packageName,
        error: result.stderr || 'Installation failed',
        executionTimeMs: result.executionTimeMs,
      };
    }
  }

  // Filesystem operations - delegate to ComputeSDK's filesystem
  async writeFile(path: string, content: string | Buffer): Promise<void> {
    if (!this._sandbox) {
      throw new Error(`Sandbox is not ready: ${this.id}`);
    }
    const contentStr = typeof content === 'string' ? content : content.toString('utf-8');
    await this._sandbox.filesystem.writeFile(path, contentStr);
  }

  async readFile(path: string): Promise<string> {
    if (!this._sandbox) {
      throw new Error(`Sandbox is not ready: ${this.id}`);
    }
    return this._sandbox.filesystem.readFile(path);
  }

  async listFiles(path: string): Promise<string[]> {
    if (!this._sandbox) {
      throw new Error(`Sandbox is not ready: ${this.id}`);
    }
    const entries = await this._sandbox.filesystem.readdir(path);
    console.log('Entries:', entries);
    return entries.map(e => e.name);
  }
}

// =============================================================================
// ComputeSDK Filesystem
// =============================================================================

/**
 * ComputeSDK filesystem provider configuration.
 */
export interface ComputeSDKFilesystemOptions {
  /** Existing ComputeSDK sandbox instance to use for filesystem operations */
  sandbox?: Sandbox;
  /** ComputeSDKSandbox instance to share sandbox with */
  workspaceSandbox?: ComputeSDKSandbox;
  /** Unique identifier for this filesystem instance */
  id?: string;
}

/**
 * ComputeSDK filesystem implementation.
 *
 * Uses ComputeSDK sandbox's filesystem for cloud-based file storage.
 * Can share a sandbox instance with ComputeSDKSandbox for unified operations.
 *
 * @example
 * ```typescript
 * // Shared sandbox approach
 * const sandbox = await compute.sandbox.create({ ... });
 * const workspace = new Workspace({
 *   filesystem: new ComputeSDKFilesystem({ sandbox }),
 *   sandbox: new ComputeSDKSandbox({ sandbox }),
 * });
 * ```
 */
export class ComputeSDKFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'ComputeSDKFilesystem';
  readonly provider = 'computesdk';

  private _sandbox: Sandbox | null = null;
  private _workspaceSandbox: ComputeSDKSandbox | null = null;

  constructor(options: ComputeSDKFilesystemOptions = {}) {
    this.id = options.id ?? `computesdk-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (options.sandbox) {
      this._sandbox = options.sandbox;
    }
    if (options.workspaceSandbox) {
      this._workspaceSandbox = options.workspaceSandbox;
    }
  }

  private getSandbox(): Sandbox {
    // Try direct sandbox first
    if (this._sandbox) {
      return this._sandbox;
    }
    // Try getting from workspace sandbox
    if (this._workspaceSandbox?.sandbox) {
      return this._workspaceSandbox.sandbox;
    }
    throw new Error(`ComputeSDKFilesystem: No sandbox available. Ensure sandbox is started.`);
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const sandbox = this.getSandbox();
    const content = await sandbox.filesystem.readFile(path);
    // ComputeSDK returns string, convert to Buffer if no encoding specified
    if (options?.encoding) {
      return content;
    }
    return Buffer.from(content, 'utf-8');
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const sandbox = this.getSandbox();

    // Create parent directories if recursive option is set
    if (options?.recursive) {
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        await this.mkdir(dir, { recursive: true });
      }
    }

    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');
    await sandbox.filesystem.writeFile(path, contentStr);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const sandbox = this.getSandbox();
    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');

    // Read existing content and append
    try {
      const existing = await sandbox.filesystem.readFile(path);
      await sandbox.filesystem.writeFile(path, existing + contentStr);
    } catch {
      // File doesn't exist, create it
      await sandbox.filesystem.writeFile(path, contentStr);
    }
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const sandbox = this.getSandbox();
    try {
      const result = await sandbox.runCommand(`rm ${options?.force ? '-f' : ''} "${path}"`);
      if (result.exitCode !== 0 && !options?.force) {
        throw new Error(`Failed to delete file: ${result.stderr}`);
      }
    } catch (error) {
      if (!options?.force) throw error;
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const sandbox = this.getSandbox();
    const flags = options?.recursive ? '-r' : '';
    const overwrite = options?.overwrite !== false ? '' : '-n';
    const result = await sandbox.runCommand(`cp ${flags} ${overwrite} "${src}" "${dest}"`);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to copy file: ${result.stderr}`);
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const sandbox = this.getSandbox();
    const overwrite = options?.overwrite !== false ? '' : '-n';
    const result = await sandbox.runCommand(`mv ${overwrite} "${src}" "${dest}"`);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to move file: ${result.stderr}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const sandbox = this.getSandbox();
    const flags = options?.recursive ? '-p' : '';
    const result = await sandbox.runCommand(`mkdir ${flags} "${path}"`);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to create directory: ${result.stderr}`);
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const sandbox = this.getSandbox();
    const flags = options?.recursive ? '-rf' : '-r';
    const force = options?.force ? '-f' : '';
    const result = await sandbox.runCommand(`rm ${flags} ${force} "${path}"`);
    if (result.exitCode !== 0 && !options?.force) {
      throw new Error(`Failed to remove directory: ${result.stderr}`);
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const sandbox = this.getSandbox();

    // Use ComputeSDK's filesystem.readdir for non-recursive listing
    if (!options?.recursive) {
      const sdkEntries = await sandbox.filesystem.readdir(path);
      let entries: FileEntry[] = sdkEntries.map(e => ({
        name: e.name,
        type: e.type === 'directory' ? 'directory' : 'file',
        size: e.type === 'file' ? e.size : undefined,
      }));

      // Filter by extension if specified
      if (options?.extension) {
        const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
        entries = entries.filter(entry => {
          if (entry.type === 'directory') return true;
          return extensions.some(ext => entry.name.endsWith(ext));
        });
      }

      return entries;
    }

    // Fall back to ls command for recursive listing (SDK doesn't support recursive)
    const result = await sandbox.runCommand(`ls -laR "${path}"`);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to read directory: ${result.stderr}`);
    }

    // Parse ls output for recursive listing
    const lines = result.stdout.split('\n').filter(line => line.trim() && !line.startsWith('total'));
    const entries: FileEntry[] = [];

    for (const line of lines) {
      // Skip directory headers in recursive mode
      if (line.endsWith(':')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const permissions = parts[0];
      const size = parseInt(parts[4], 10);
      const name = parts.slice(8).join(' ');

      // Skip . and ..
      if (name === '.' || name === '..') continue;

      const isDirectory = permissions?.startsWith('d');
      entries.push({
        name,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : size,
      });
    }

    // Filter by extension if specified
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
    const sandbox = this.getSandbox();
    const result = await sandbox.runCommand(`test -e "${path}" && echo "exists" || echo "not found"`);
    return result.stdout.trim() === 'exists';
  }

  async stat(path: string): Promise<FileStat> {
    const sandbox = this.getSandbox();

    // Use stat command to get file info
    const result = await sandbox.runCommand(
      `stat -c '%n|%F|%s|%Y|%W' "${path}" 2>/dev/null || stat -f '%N|%HT|%z|%m|%B' "${path}"`,
    );

    if (result.exitCode !== 0) {
      throw new Error(`File not found: ${path}`);
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
    const sandbox = this.getSandbox();
    const result = await sandbox.runCommand(`test -f "${path}" && echo "true" || echo "false"`);
    return result.stdout.trim() === 'true';
  }

  async isDirectory(path: string): Promise<boolean> {
    const sandbox = this.getSandbox();
    const result = await sandbox.runCommand(`test -d "${path}" && echo "true" || echo "false"`);
    return result.stdout.trim() === 'true';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // No initialization needed - sandbox handles this
  }

  async destroy(): Promise<void> {
    // Don't destroy the sandbox - it's shared or managed externally
    this._sandbox = null;
    this._workspaceSandbox = null;
  }
}
