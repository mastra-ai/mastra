import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import type {
  CommandResult,
  ExecuteCommandOptions,
  FilesystemMountConfig,
  MastraSandboxOptions,
  MountManager,
  MountResult,
  ProviderStatus,
  SandboxFileInput,
  SandboxInfo,
  WorkspaceFilesystem,
} from '@mastra/core/workspace';
import { MastraSandbox, assertModesUnsupported } from '@mastra/core/workspace';
import {
  CloudflareSandboxBridgeClient,
  type CloudflareMountBucketRequest,
  type CloudflarePersistWorkspaceOptions,
  type CloudflareSandboxBridgeClientOptions,
} from './bridge-client';

const DEFAULT_COMMAND_TIMEOUT_MS = 300_000;
const WORKSPACE_ROOT = '/workspace';

type InstructionsOption = string | ((options: { defaultInstructions: string }) => string);
type BridgeClient = Pick<
  CloudflareSandboxBridgeClient,
  | 'createSandbox'
  | 'isRunning'
  | 'deleteSandbox'
  | 'writeFile'
  | 'readFile'
  | 'persistWorkspace'
  | 'hydrateWorkspace'
  | 'mountBucket'
  | 'unmountBucket'
  | 'exec'
>;

/**
 * Mount config accepted by the Cloudflare bridge: any S3-compatible bucket
 * (R2, S3, MinIO, ...) as produced by `S3Filesystem.getMountConfig()`.
 * Declared structurally so this package does not depend on `@mastra/s3`.
 */
interface S3CompatibleMountConfig extends FilesystemMountConfig {
  type: 's3';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  prefix?: string;
  readOnly?: boolean;
}

/** Allowlist pattern for mount paths, matching the other remote sandbox providers. */
const SAFE_MOUNT_PATH = /^\/[a-zA-Z0-9_.\-/]+$/;

function validateMountPath(mountPath: string): void {
  if (!SAFE_MOUNT_PATH.test(mountPath)) {
    throw new Error(
      `Invalid mount path: ${mountPath}. Must be an absolute path with alphanumeric, dash, dot, underscore, or slash characters only.`,
    );
  }
}

/**
 * Translates a Workspace mount config into the bridge's mount request, or
 * explains why the bridge cannot serve it. The bridge mounts S3-compatible
 * buckets with s3fs; GCS and Azure mount configs have no equivalent route.
 */
function toMountRequest(
  config: FilesystemMountConfig,
  mountPath: string,
): { request: CloudflareMountBucketRequest } | { error: string } {
  if (config.type !== 's3') {
    return { error: `Cloudflare Sandbox can only mount S3-compatible buckets; got mount type "${config.type}"` };
  }
  const s3 = config as S3CompatibleMountConfig;
  if (s3.sessionToken) {
    return { error: 'Cloudflare Sandbox bucket mounts do not support temporary credentials (sessionToken)' };
  }
  if (Boolean(s3.accessKeyId) !== Boolean(s3.secretAccessKey)) {
    return { error: 'Cloudflare Sandbox bucket mounts need both accessKeyId and secretAccessKey, or neither' };
  }
  // The bridge treats a request without an endpoint as an R2 *binding* mount, so
  // a plain AWS S3Filesystem (region only) needs its regional endpoint spelled out.
  const endpoint =
    s3.endpoint ?? (s3.region && s3.region !== 'auto' ? `https://s3.${s3.region}.amazonaws.com` : undefined);
  if (!endpoint) {
    return { error: 'Cloudflare Sandbox bucket mounts need an S3 endpoint or an AWS region' };
  }
  // S3Filesystem emits "dir/" while the bridge requires "/dir".
  const trimmedPrefix = s3.prefix?.replace(/^\/+|\/+$/g, '');
  return {
    request: {
      bucket: s3.bucket,
      mountPath,
      options: {
        endpoint,
        prefix: trimmedPrefix ? `/${trimmedPrefix}` : undefined,
        readOnly: s3.readOnly,
        credentials:
          s3.accessKeyId && s3.secretAccessKey
            ? { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey }
            : undefined,
      },
    },
  };
}

export interface CloudflareSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** URL of a deployed Cloudflare Sandbox Bridge Worker. */
  baseUrl: string;
  /** Bearer token matching the Worker's `SANDBOX_API_KEY` secret, when authentication is enabled. */
  apiToken?: string;
  /** Stable Mastra identifier for this sandbox instance. */
  id?: string;
  /** Existing Cloudflare sandbox ID to reconnect to instead of creating a sandbox. */
  sandboxId?: string;
  /** Human-readable name shown in Mastra sandbox metadata. */
  name?: string;
  /** Environment variables applied to every command. */
  env?: Record<string, string>;
  /** Working directory applied to every command. Must be under /workspace. */
  workingDirectory?: string;
  /** Default command timeout in milliseconds. */
  commandTimeout?: number;
  /** Custom instructions returned by getInstructions(). */
  instructions?: InstructionsOption;
  /** Custom fetch implementation, primarily for advanced networking setup and tests. */
  fetch?: CloudflareSandboxBridgeClientOptions['fetch'];
  /** Preconfigured Bridge client, primarily for tests. */
  client?: BridgeClient;
}

/**
 * Absolute path to the shell used to interpret bare command strings. Absolute so it
 * resolves even when a custom PATH excludes the standard system directories.
 */
const SHELL_PATH = '/bin/bash';

/**
 * Builds the argv array sent to the bridge. The bridge applies ANSI-C quoting to
 * every element, so no local escaping is needed. Environment variables are applied
 * with `env`, which keeps each assignment a separate argv element.
 *
 * When no separate arguments are supplied (the shape the built-in Workspace
 * `execute_command` tool uses), `command` is a shell command string — pipes,
 * chaining, quoting, redirection — so it is run through a non-login shell rather
 * than treated as a single executable name. When explicit arguments are given,
 * each element stays a literal argv token.
 */
function buildArgv(command: string, args: string[] | undefined, env: Record<string, string>): string[] {
  const assignments = Object.entries(env).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name: ${key}`);
    return `${key}=${value}`;
  });
  const invocation = args && args.length > 0 ? [command, ...args] : [SHELL_PATH, '-c', command];
  return assignments.length ? ['env', ...assignments, ...invocation] : invocation;
}

/** Resolves a path inside /workspace, rejecting anything that escapes the workspace root. */
function resolveWorkspacePath(path: string): string {
  const resolved = posix.resolve(WORKSPACE_ROOT, path);
  if (resolved !== WORKSPACE_ROOT && !resolved.startsWith(`${WORKSPACE_ROOT}/`)) {
    throw new Error(`Cloudflare Sandbox files must be written under ${WORKSPACE_ROOT}: ${path}`);
  }
  return resolved;
}

export class CloudflareSandbox extends MastraSandbox {
  readonly id: string;
  readonly name: string;
  readonly provider = 'cloudflare-sandbox';
  status: ProviderStatus = 'pending';
  /** Created by MastraSandbox because this class implements mount(). */
  declare readonly mounts: MountManager;

  private readonly client: BridgeClient;
  private readonly commandTimeout: number;
  private readonly instructions?: InstructionsOption;
  private sandboxId?: string;
  private createdAt = new Date();
  private lastUsedAt?: Date;

  constructor(options: CloudflareSandboxOptions) {
    const name = options.name ?? 'Cloudflare Sandbox';
    super({ ...options, name });
    this.id = options.id ?? `cloudflare-sandbox-${randomUUID()}`;
    this.name = name;
    this.sandboxId = options.sandboxId;
    this.commandTimeout = options.commandTimeout ?? DEFAULT_COMMAND_TIMEOUT_MS;
    this.instructions = options.instructions;
    this.client =
      options.client ??
      new CloudflareSandboxBridgeClient({ baseUrl: options.baseUrl, apiToken: options.apiToken, fetch: options.fetch });
  }

  async start(): Promise<void> {
    if (this.sandboxId) {
      // The bridge boots the container on demand, so a stopped container is not fatal.
      const running = await this.client.isRunning(this.sandboxId);
      if (!running) {
        this.logger?.debug(`Cloudflare sandbox ${this.sandboxId} is not running yet; it starts on first use`);
      }
      return;
    }
    this.sandboxId = await this.client.createSandbox();
    this.createdAt = new Date();
  }

  async stop(): Promise<void> {
    // The bridge exposes create/delete but no suspend operation. Stop detaches this
    // Mastra lifecycle while preserving the remote sandbox for later reconnection.
  }

  async destroy(): Promise<void> {
    if (!this.sandboxId) return;
    await this.client.deleteSandbox(this.sandboxId);
    this.sandboxId = undefined;
  }

  async executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult> {
    const sandboxId = this.requireSandboxId();

    const startedAt = Date.now();
    const timeout = options?.timeout ?? this.commandTimeout;
    if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError('Command timeout must be positive');

    const controller = new AbortController();
    let didTimeout = false;
    const timer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeout);
    const signal = options?.abortSignal ? AbortSignal.any([controller.signal, options.abortSignal]) : controller.signal;

    // stdout and stderr are separate byte streams, so each needs its own streaming decoder.
    const stdoutDecoder = new TextDecoder();
    const stderrDecoder = new TextDecoder();
    let stdout = '';
    let stderr = '';
    let exitCode = 1;

    const env = Object.fromEntries(
      Object.entries({ ...this.getEnv(), ...options?.env }).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );

    try {
      await this.client.exec(
        sandboxId,
        {
          argv: buildArgv(command, args, env),
          timeoutMs: timeout,
          cwd: options?.cwd ?? this.workingDirectory,
        },
        {
          signal,
          onEvent: event => {
            switch (event.type) {
              case 'stdout': {
                const chunk = stdoutDecoder.decode(event.data, { stream: true });
                if (!chunk) return;
                stdout += chunk;
                options?.onStdout?.(chunk);
                return;
              }
              case 'stderr': {
                const chunk = stderrDecoder.decode(event.data, { stream: true });
                if (!chunk) return;
                stderr += chunk;
                options?.onStderr?.(chunk);
                return;
              }
              case 'exit':
                exitCode = event.exitCode;
                return;
              case 'error':
                stderr += event.message;
                options?.onStderr?.(event.message);
                return;
            }
          },
        },
      );
    } catch (error) {
      if (!signal.aborted) throw error;
    } finally {
      clearTimeout(timer);
    }

    // Flush each decoder so a trailing truncated multi-byte sequence isn't dropped.
    const stdoutTail = stdoutDecoder.decode();
    if (stdoutTail) {
      stdout += stdoutTail;
      options?.onStdout?.(stdoutTail);
    }
    const stderrTail = stderrDecoder.decode();
    if (stderrTail) {
      stderr += stderrTail;
      options?.onStderr?.(stderrTail);
    }

    this.lastUsedAt = new Date();
    return {
      command,
      args,
      success: exitCode === 0 && !signal.aborted,
      exitCode,
      stdout,
      stderr,
      executionTimeMs: Date.now() - startedAt,
      timedOut: didTimeout,
      killed: signal.aborted && !didTimeout,
    };
  }

  async writeFiles(files: SandboxFileInput[]): Promise<void> {
    assertModesUnsupported(files, 'Cloudflare');
    const sandboxId = this.requireSandboxId();
    // The bridge writes one file per request.
    for (const file of files) {
      await this.client.writeFile(sandboxId, resolveWorkspacePath(file.path), file.content);
    }
    this.lastUsedAt = new Date();
  }

  /** Reads a single file under /workspace, returning its raw bytes. */
  async readFile(path: string): Promise<Uint8Array> {
    const sandboxId = this.requireSandboxId();
    const bytes = await this.client.readFile(sandboxId, resolveWorkspacePath(path));
    this.lastUsedAt = new Date();
    return bytes;
  }

  /** Archives /workspace, returning raw tar bytes that can later restore it via hydrateWorkspace. */
  async persistWorkspace(options?: CloudflarePersistWorkspaceOptions): Promise<Uint8Array> {
    const sandboxId = this.requireSandboxId();
    const archive = await this.client.persistWorkspace(sandboxId, options);
    this.lastUsedAt = new Date();
    return archive;
  }

  /** Restores /workspace from a raw tar payload produced by persistWorkspace. */
  async hydrateWorkspace(tar: Uint8Array): Promise<void> {
    const sandboxId = this.requireSandboxId();
    await this.client.hydrateWorkspace(sandboxId, tar);
    this.lastUsedAt = new Date();
  }

  getInfo(): SandboxInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this.createdAt,
      lastUsedAt: this.lastUsedAt,
      metadata: {
        sandboxId: this.sandboxId,
        bridgeBaseUrl: this.client instanceof CloudflareSandboxBridgeClient ? this.client.baseUrl : undefined,
      },
    };
  }

  /**
   * Mounts an S3-compatible bucket (R2, S3, MinIO, ...) at `mountPath` through
   * the bridge's mount route. Called by MountManager for each Workspace `mounts`
   * entry after start(); the Cloudflare Sandbox re-establishes the mount itself
   * when a slept container boots, so mounted paths are the durable part of the
   * filesystem.
   */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    validateMountPath(mountPath);
    const sandboxId = this.requireSandboxId();

    const config = filesystem.getMountConfig?.();
    if (!config) {
      const error = `Filesystem "${filesystem.id}" does not provide a mount config`;
      this.mounts.set(mountPath, { filesystem, state: 'error', error });
      return { success: false, mountPath, error };
    }

    const translated = toMountRequest(config, mountPath);
    if ('error' in translated) {
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error: translated.error });
      return { success: false, mountPath, error: translated.error };
    }

    this.mounts.set(mountPath, { filesystem, state: 'mounting', config });
    try {
      await this.client.mountBucket(sandboxId, translated.request);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause);
      this.mounts.set(mountPath, { filesystem, state: 'error', config, error });
      return { success: false, mountPath, error };
    }
    this.mounts.set(mountPath, { filesystem, state: 'mounted', config });
    this.lastUsedAt = new Date();
    return { success: true, mountPath };
  }

  /** Unmounts a bucket previously mounted with {@link mount}. */
  async unmount(mountPath: string): Promise<void> {
    validateMountPath(mountPath);
    const sandboxId = this.requireSandboxId();
    await this.client.unmountBucket(sandboxId, mountPath);
    this.mounts.delete(mountPath);
    this.lastUsedAt = new Date();
  }

  getInstructions(): string {
    const mounted = [...this.mounts.entries].filter(([, entry]) => entry.state === 'mounted').map(([path]) => path);
    const defaultInstructions =
      mounted.length > 0
        ? `Commands execute in a remote Cloudflare Sandbox. The container sleeps when idle and files under /workspace do NOT survive between commands, except under the mounted paths: ${mounted.join(', ')}. Keep anything that must persist under a mounted path.`
        : 'Commands execute in a remote Cloudflare Sandbox. Use /workspace as scratch space only: the container sleeps when idle and files under /workspace do NOT survive between commands. Do not assume earlier files still exist.';
    return typeof this.instructions === 'function'
      ? this.instructions({ defaultInstructions })
      : (this.instructions ?? defaultInstructions);
  }

  private requireSandboxId(): string {
    if (!this.sandboxId) throw new Error(`Cloudflare Sandbox ${this.id} has not been started`);
    return this.sandboxId;
  }
}
