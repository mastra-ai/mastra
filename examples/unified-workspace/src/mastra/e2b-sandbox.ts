/**
 * E2B Sandbox Provider
 *
 * Direct E2B integration for code execution in cloud sandboxes.
 * Uses @e2b/code-interpreter package directly.
 *
 * @see https://e2b.dev/docs
 */

import { NotFoundError, Sandbox } from '@e2b/code-interpreter';
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
  SandboxIdResolver,
  SharedSandboxOptions,
} from '@mastra/core/workspace';
import { resolveSandboxId } from '@mastra/core/workspace';

// =============================================================================
// E2B Sandbox
// =============================================================================

/**
 * E2B sandbox provider configuration.
 */
export interface E2BSandboxOptions {
  /** Pass an existing E2B sandbox instance (shared mode) */
  sandbox?: Sandbox;
  /**
   * Unique identifier for this sandbox instance.
   * Can be a static string or a function that resolves the ID from context.
   *
   * @example Static ID
   * ```typescript
   * id: 'my-sandbox'
   * ```
   *
   * @example Dynamic ID from thread/resource context
   * ```typescript
   * id: (ctx) => `${ctx.resourceId}-${ctx.threadId}`
   * ```
   */
  id?: SandboxIdResolver;
  /** Sandbox template ID */
  template?: string;
  /** Execution timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Supported runtimes (default: ['node', 'python', 'bash']) */
  runtimes?: SandboxRuntime[];
}

/**
 * E2B sandbox implementation using @e2b/code-interpreter directly.
 *
 * @example Static sandbox ID
 * ```typescript
 * const sandbox = new E2BSandbox({
 *   id: 'my-sandbox',
 *   timeout: 60000,
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * await workspace.init();
 * const result = await workspace.executeCode('console.log("Hello!")');
 * ```
 *
 * @example Dynamic sandbox ID (per thread/resource)
 * ```typescript
 * // Each thread/resource combination gets its own isolated sandbox
 * const sandbox = new E2BSandbox({
 *   id: (ctx) => `${ctx.resourceId}-${ctx.threadId}`,
 *   timeout: 60000,
 * });
 *
 * const workspace = new Workspace({ sandbox });
 * // When agent executes with threadId='thread-1', resourceId='user-1',
 * // a sandbox with ID 'user-1-thread-1' will be created/used
 * ```
 */
export class E2BSandbox implements WorkspaceSandbox {
  readonly name = 'E2BSandbox';
  readonly provider = 'e2b';

  private _status: SandboxStatus = 'stopped';
  /** Map of sandbox instances keyed by logical ID */
  private _sandboxes: Map<string, Sandbox> = new Map();
  /** Shared sandbox instance (when user passes existing Sandbox) */
  private _sharedSandbox: Sandbox | null = null;

  private readonly _idConfig: SandboxIdResolver;
  private readonly timeout: number;
  private readonly metadata: Record<string, unknown>;
  private readonly configuredRuntimes: SandboxRuntime[];

  filesystem: E2BFilesystem;

  constructor(options: E2BSandboxOptions = {}) {
    this._idConfig = options.id ?? 'default';
    this.timeout = options.timeout ?? 30000;
    this.metadata = options.metadata ?? {};
    this.configuredRuntimes = options.runtimes ?? ['node', 'python', 'bash'];

    // If a sandbox instance is passed, use it directly (shared mode)
    if (options.sandbox) {
      this._sharedSandbox = options.sandbox;
      this._status = 'running';
    }

    this.filesystem = new E2BFilesystem({
      workspaceSandbox: this,
    });
  }

  /**
   * The sandbox ID (returns resolved ID with no context).
   */
  get id(): string {
    return this.resolveId();
  }

  /**
   * Resolve the sandbox ID from options.
   * If id is a string, returns that string.
   * If id is a function, calls it with context from options.
   */
  private resolveId(options?: SharedSandboxOptions): string {
    return resolveSandboxId(this._idConfig, options);
  }

  /**
   * Get sandbox instance for the given options.
   * Returns shared sandbox if configured, otherwise looks up by resolved ID.
   */
  getSandbox(options?: SharedSandboxOptions): Sandbox | null {
    if (this._sharedSandbox) {
      return this._sharedSandbox;
    }
    const id = this.resolveId(options);
    return this._sandboxes.get(id) ?? null;
  }

  /**
   * Overall status - 'running' if any sandbox is active.
   */
  get status(): SandboxStatus {
    if (this._status === 'destroyed') return 'destroyed';
    if (this._status === 'error') return 'error';
    if (this._sharedSandbox || this._sandboxes.size > 0) {
      return 'running';
    }
    return this._status;
  }

  /**
   * Get status for a specific sandbox (by resolved ID).
   */
  getStatus(options?: SharedSandboxOptions): SandboxStatus {
    if (this._status === 'destroyed') return 'destroyed';
    if (this._status === 'error') return 'error';
    if (this._sharedSandbox) return 'running';

    const id = this.resolveId(options);
    return this._sandboxes.has(id) ? 'running' : 'stopped';
  }

  get supportedRuntimes(): readonly SandboxRuntime[] {
    return this.configuredRuntimes;
  }

  get defaultRuntime(): SandboxRuntime {
    return this.configuredRuntimes[0] ?? 'node';
  }

  /**
   * Start/get the sandbox for the given options.
   * Looks for existing sandbox with matching metadata, otherwise creates new one.
   */
  async start(options?: SharedSandboxOptions): Promise<void> {
    // Shared sandbox is always ready
    if (this._sharedSandbox) {
      this._status = 'running';
      return;
    }

    await this.ensureSandboxForId(options);
  }

  /**
   * Ensure a sandbox exists for the resolved ID.
   * Looks for existing sandbox with matching metadata, otherwise creates new one.
   */
  private async ensureSandboxForId(options?: SharedSandboxOptions): Promise<Sandbox> {
    const logicalId = this.resolveId(options);

    // Check if we already have a sandbox cached for this logical ID
    let sandbox = this._sandboxes.get(logicalId);
    if (sandbox) {
      return sandbox;
    }

    // Query E2B for existing sandbox with our logical ID in metadata
    try {
      const paginator = Sandbox.list({
        query: {
          metadata: {
            'mastra-sandbox-id': logicalId,
          },
          state: ['running', 'paused'],
        },
        limit: 1,
      });

      const sandboxes = await paginator.nextItems();

      if (sandboxes.length > 0) {
        const existingSandbox = sandboxes[0];
        console.log(`[E2BSandbox] Found existing sandbox for ${logicalId}: ${existingSandbox.sandboxId}`);
        sandbox = await Sandbox.connect(existingSandbox.sandboxId);
        this._sandboxes.set(logicalId, sandbox);
        this._status = 'running';
        return sandbox;
      }
    } catch (e) {
      console.log(`[E2BSandbox] Error querying for existing sandbox:`, e);
      // Continue to create new sandbox
    }

    // Create a new sandbox with our logical ID in metadata
    console.log(`[E2BSandbox] Creating new sandbox for: ${logicalId}`);
    sandbox = await Sandbox.create({
      metadata: {
        ...this.metadata,
        'mastra-sandbox-id': logicalId,
      },
      timeoutMs: this.timeout,
    });

    console.log(`[E2BSandbox] Created sandbox ${sandbox.sandboxId} for logical ID: ${logicalId}`);
    this._sandboxes.set(logicalId, sandbox);
    this._status = 'running';

    return sandbox;
  }

  async stop(options?: SharedSandboxOptions): Promise<void> {
    const id = this.resolveId(options);
    this._sandboxes.delete(id);

    // Set to stopped if no sandboxes remain
    if (this._sandboxes.size === 0 && !this._sharedSandbox) {
      this._status = 'stopped';
    }
  }

  async destroy(_options?: SharedSandboxOptions): Promise<void> {
    // Don't destroy shared sandbox (we don't own it)
    if (!this._sharedSandbox) {
      // Destroy all sandboxes
      const sandboxEntries = Array.from(this._sandboxes.entries());
      for (const [id, sandbox] of sandboxEntries) {
        try {
          console.log(`[E2BSandbox] Destroying sandbox: ${id}`);
          await sandbox.kill();
        } catch {
          // Ignore errors during destroy
        }
      }
    }
    this._sharedSandbox = null;
    this._sandboxes.clear();
    this._status = 'destroyed';
  }

  async isReady(options?: SharedSandboxOptions): Promise<boolean> {
    return this.getSandbox(options) !== null;
  }

  /**
   * Handle sandbox timeout - reset internal state so sandbox can be recreated.
   * Called by E2BFilesystem when a timeout error is detected.
   */
  handleSandboxTimeout(options?: SharedSandboxOptions): void {
    const id = this.resolveId(options);
    this._sandboxes.delete(id);

    // Set to stopped if no sandboxes remain
    if (this._sandboxes.size === 0 && !this._sharedSandbox) {
      this._status = 'stopped';
    }
  }

  /**
   * Check if an error is a sandbox timeout error.
   */
  private isSandboxTimeoutError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = String(error);
    return (
      errorStr.includes('sandbox was not found') ||
      errorStr.includes('sandbox timeout') ||
      errorStr.includes('TimeoutError') ||
      (error instanceof Error && error.name === 'TimeoutError')
    );
  }

  async getInfo(options?: SharedSandboxOptions): Promise<SandboxInfo> {
    return {
      id: this.resolveId(options),
      name: this.name,
      provider: this.provider,
      status: this.getStatus(options),
      createdAt: new Date(),
      metadata: {
        ...this.metadata,
        activeSandboxCount: this._sandboxes.size + (this._sharedSandbox ? 1 : 0),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Code Execution
  // ---------------------------------------------------------------------------

  async executeCode(code: string, options: ExecuteCodeOptions = {}, _isRetry = false): Promise<CodeResult> {
    // Get or create sandbox for this execution context (shared or by resolved ID)
    const sandbox = this._sharedSandbox ?? (await this.ensureSandboxForId(options));

    const startTime = Date.now();
    const runtime = options.runtime ?? this.defaultRuntime;
    const language = this.mapRuntimeToLanguage(runtime);

    console.log(`[E2BSandbox] executeCode on sandbox: ${this.resolveId(options)}`);

    try {
      const execution = await sandbox.runCode(code, { language });

      const executionTimeMs = Date.now() - startTime;
      const hasError = !!execution.error;

      // Get error message if present
      const errorStr = execution.error ? String(execution.error.value ?? execution.error.name ?? '') : '';

      return {
        success: !hasError,
        exitCode: hasError ? 1 : 0,
        stdout: execution.logs.stdout.join('\n'),
        stderr: execution.logs.stderr.join('\n') + errorStr,
        executionTimeMs,
        runtime,
        returnValue: execution.text ?? undefined,
      };
    } catch (error) {
      // Handle sandbox timeout - retry once with fresh sandbox
      if (!_isRetry && this.isSandboxTimeoutError(error)) {
        this.handleSandboxTimeout(options);
        return this.executeCode(code, options, true);
      }

      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: errorMessage,
        executionTimeMs,
        runtime,
      };
    }
  }

  private mapRuntimeToLanguage(runtime: SandboxRuntime): 'python' | 'js' | 'ts' | 'r' | 'java' {
    switch (runtime) {
      case 'python':
        return 'python';
      case 'node':
        return 'js';
      case 'deno':
      case 'bun':
        return 'ts';
      default:
        return 'js';
    }
  }

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  async executeCommand(
    command: string,
    args: string[] = [],
    options: ExecuteCommandOptions = {},
    _isRetry = false,
  ): Promise<CommandResult> {
    // Get or create sandbox for this execution context (shared or by resolved ID)
    const sandbox = this._sharedSandbox ?? (await this.ensureSandboxForId(options));

    const startTime = Date.now();
    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    console.log(`[E2BSandbox] executeCommand on sandbox: ${this.resolveId(options)}`);

    try {
      const result = await sandbox.commands.run(fullCommand, {
        cwd: options.cwd,
        envs: options.env,
        timeoutMs: options.timeout,
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTimeMs,
        command,
        args,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.log('[E2BSandbox] Sandbox not found, retrying with new sandbox:', error);
        this.handleSandboxTimeout(options);
        return this.executeCommand(command, args, options, true);
      }

      console.log('[E2BSandbox] Error executing command:', error);
      // Handle sandbox timeout - retry once with fresh sandbox
      if (!_isRetry && this.isSandboxTimeoutError(error)) {
        this.handleSandboxTimeout(options);
        return this.executeCommand(command, args, options, true);
      }

      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: errorMessage,
        executionTimeMs,
        command,
        args,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Package Management
  // ---------------------------------------------------------------------------

  async installPackage(packageName: string, options: InstallPackageOptions = {}): Promise<InstallPackageResult> {
    const startTime = Date.now();
    const pm = options.packageManager ?? 'auto';

    // Determine package manager
    let command: string;
    if (pm === 'pip' || pm === 'auto') {
      command = `pip install ${packageName}${options.version ? `==${options.version}` : ''}`;
    } else if (pm === 'npm' || pm === 'yarn' || pm === 'pnpm') {
      const pmCmd = pm === 'npm' ? 'npm install' : pm === 'yarn' ? 'yarn add' : 'pnpm add';
      const devFlag = options.dev ? ' -D' : '';
      const versionSuffix = options.version ? `@${options.version}` : '';
      command = `${pmCmd}${devFlag} ${packageName}${versionSuffix}`;
    } else {
      command = `pip install ${packageName}`;
    }

    const result = await this.executeCommand(command, [], { timeout: options.timeout ?? 60000 });

    return {
      success: result.success,
      packageName,
      version: options.version,
      error: result.success ? undefined : result.stderr,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async installPackages(packages: string[], options: InstallPackageOptions = {}): Promise<InstallPackageResult[]> {
    const results: InstallPackageResult[] = [];
    for (const pkg of packages) {
      results.push(await this.installPackage(pkg, options));
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Filesystem Operations (Sandbox's internal FS)
  // ---------------------------------------------------------------------------

  async writeFile(path: string, content: string | Buffer, options?: WriteOptions): Promise<void> {
    const sandbox = this._sharedSandbox ?? (await this.ensureSandboxForId(options));
    const contentStr = typeof content === 'string' ? content : content.toString('utf-8');
    await sandbox.files.write(path, contentStr);
  }

  async readFile(path: string, options?: ReadOptions): Promise<string> {
    const sandbox = this._sharedSandbox ?? (await this.ensureSandboxForId(options));
    return sandbox.files.read(path);
  }

  async listFiles(path: string, options?: ListOptions): Promise<string[]> {
    const sandbox = this._sharedSandbox ?? (await this.ensureSandboxForId(options));
    const entries = await sandbox.files.list(path);
    return entries.map((e: { name: string }) => e.name);
  }
}

// =============================================================================
// E2B Filesystem
// =============================================================================

/**
 * E2B filesystem provider configuration.
 */
export interface E2BFilesystemOptions {
  /** Existing E2B sandbox instance to use for filesystem operations */
  sandbox?: Sandbox;
  /** E2BSandbox instance to share sandbox with */
  workspaceSandbox?: E2BSandbox;
  /** Unique identifier for this filesystem instance */
  id?: string;
}

/**
 * E2B filesystem implementation.
 *
 * Uses E2B sandbox's files API for cloud-based file storage.
 * Can share a sandbox instance with E2BSandbox for unified operations.
 */
export class E2BFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'E2BFilesystem';
  readonly provider = 'e2b';

  private _sandbox: Sandbox | null = null;
  private _workspaceSandbox: E2BSandbox | null = null;

  constructor(options: E2BFilesystemOptions = {}) {
    this.id = options.id ?? `e2b-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (options.sandbox) {
      this._sandbox = options.sandbox;
    }
    if (options.workspaceSandbox) {
      this._workspaceSandbox = options.workspaceSandbox;
    }
  }

  private async ensureSandbox(options?: SharedSandboxOptions): Promise<Sandbox> {
    // Direct sandbox reference (non-dynamic mode)
    if (this._sandbox) {
      return this._sandbox;
    }

    if (this._workspaceSandbox) {
      // For dynamic sandboxes, use getSandbox with options
      let sandbox = this._workspaceSandbox.getSandbox(options);
      if (!sandbox) {
        // Lazy start the sandbox - pass options for dynamic ID resolution
        await this._workspaceSandbox.start(options);
        sandbox = this._workspaceSandbox.getSandbox(options);
      }
      if (sandbox) {
        return sandbox;
      }
    }

    throw new Error(`E2BFilesystem: No sandbox available. Ensure sandbox is started.`);
  }

  /**
   * Wrap a filesystem operation with timeout error handling.
   * If the sandbox has timed out, reset and retry once.
   */
  private async withSandboxRetry<T>(
    operation: (sandbox: Sandbox) => Promise<T>,
    options?: SharedSandboxOptions,
  ): Promise<T> {
    try {
      const sandbox = await this.ensureSandbox(options);
      return await operation(sandbox);
    } catch (error) {
      // Check if this is a sandbox timeout error
      if (this.isSandboxTimeoutError(error)) {
        // Reset the workspace sandbox state so it can be recreated
        if (this._workspaceSandbox) {
          this._workspaceSandbox.handleSandboxTimeout(options);
        }
        this._sandbox = null;

        // Retry once with a fresh sandbox
        const sandbox = await this.ensureSandbox(options);
        return await operation(sandbox);
      }
      throw error;
    }
  }

  private isSandboxTimeoutError(error: unknown): boolean {
    if (!error) return false;
    const errorStr = String(error);
    return (
      errorStr.includes('sandbox was not found') ||
      errorStr.includes('sandbox timeout') ||
      errorStr.includes('TimeoutError') ||
      (error instanceof Error && error.name === 'TimeoutError')
    );
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    return this.withSandboxRetry(async sandbox => {
      const content = await sandbox.files.read(path);
      if (options?.encoding) {
        return content;
      }
      return Buffer.from(content, 'utf-8');
    }, options);
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    if (options?.recursive) {
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir) {
        await this.mkdir(dir, { recursive: true });
      }
    }

    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');
    return this.withSandboxRetry(async sandbox => {
      await sandbox.files.write(path, contentStr);
    }, options);
  }

  async appendFile(path: string, content: FileContent, options?: SharedSandboxOptions): Promise<void> {
    const contentStr = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');

    return this.withSandboxRetry(async sandbox => {
      try {
        const existing = await sandbox.files.read(path);
        await sandbox.files.write(path, existing + contentStr);
      } catch {
        await sandbox.files.write(path, contentStr);
      }
    }, options);
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    return this.withSandboxRetry(async sandbox => {
      try {
        await sandbox.files.remove(path);
      } catch (error) {
        if (!options?.force) throw error;
      }
    }, options);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(`cp "${src}" "${dest}"`);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to copy file: ${result.stderr}`);
      }
    }, options);
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(`mv "${src}" "${dest}"`);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to move file: ${result.stderr}`);
      }
    }, options);
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean } & SharedSandboxOptions): Promise<void> {
    const flags = options?.recursive ? '-p' : '';
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(`mkdir ${flags} "${path}"`);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to create directory: ${result.stderr}`);
      }
    }, options);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const flags = options?.recursive ? '-rf' : '-r';
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(`rm ${flags} "${path}"`);
      if (result.exitCode !== 0 && !options?.force) {
        throw new Error(`Failed to remove directory: ${result.stderr}`);
      }
    }, options);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    return this.withSandboxRetry(async sandbox => {
      if (!options?.recursive) {
        const entries = await sandbox.files.list(path);
        let fileEntries: FileEntry[] = entries.map(e => ({
          name: e.name,
          type: e.type === 'dir' ? 'directory' : 'file',
          size: undefined, // E2B doesn't provide size in list
        }));

        if (options?.extension) {
          const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
          fileEntries = fileEntries.filter(entry => {
            if (entry.type === 'directory') return true;
            return extensions.some((ext: string) => entry.name.endsWith(ext));
          });
        }

        return fileEntries;
      }

      // Fall back to ls for recursive
      const result = await sandbox.commands.run(`ls -laR "${path}"`);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to read directory: ${result.stderr}`);
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
          return extensions.some((ext: string) => entry.name.endsWith(ext));
        });
      }

      return entries;
    }, options);
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string, options?: SharedSandboxOptions): Promise<boolean> {
    return this.withSandboxRetry(async sandbox => {
      try {
        await sandbox.files.list(path);
        return true;
      } catch {
        // Try as file
        try {
          await sandbox.files.read(path);
          return true;
        } catch {
          return false;
        }
      }
    }, options);
  }

  async stat(path: string, options?: SharedSandboxOptions): Promise<FileStat> {
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(
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
    }, options);
  }

  async isFile(path: string, options?: SharedSandboxOptions): Promise<boolean> {
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(`test -f "${path}" && echo "true" || echo "false"`);
      return result.stdout.trim() === 'true';
    }, options);
  }

  async isDirectory(path: string, options?: SharedSandboxOptions): Promise<boolean> {
    return this.withSandboxRetry(async sandbox => {
      const result = await sandbox.commands.run(`test -d "${path}" && echo "true" || echo "false"`);
      return result.stdout.trim() === 'true';
    }, options);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // No initialization needed
  }

  async destroy(): Promise<void> {
    this._sandbox = null;
    this._workspaceSandbox = null;
  }
}
