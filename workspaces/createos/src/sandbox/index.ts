import { createHash } from 'node:crypto';

import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import type {
  FilesystemMountConfig,
  MastraSandboxOptions,
  MountManager,
  MountResult,
  ProviderStatus,
  SandboxComputer,
  SandboxCloneOptions,
  SandboxFileInput,
  SandboxInfo,
  SandboxNetworking,
  WorkspaceFilesystem,
} from '@mastra/core/workspace';
import {
  CreateosSandboxApiError,
  CreateosSandboxClient,
  CreateosSandboxNotFoundError,
  CreateosSandboxValidationError,
} from '@nodeops-createos/sandbox';
import type {
  CreateosSandboxClientOptions,
  CreateSandboxRequest,
  RetryOptions,
  Sandbox,
  SandboxStatus,
} from '@nodeops-createos/sandbox';

import { CreateOSComputer } from './computer';
import type { CreateOSComputerUseOptions } from './computer';
import { errorToString, resolveCreateOSDisk, sameDiskConfig, validateMountPath } from './mounts';
import type { CreateOSS3MountConfig, ResolvedCreateOSDisk } from './mounts';
import { CreateOSProcessManager } from './process-manager';

export const DEFAULT_CREATEOS_SHAPE = 's-2vcpu-2gb';
export const DEFAULT_CREATEOS_DESKTOP_ROOTFS = 'desktop:1';

const TERMINAL_STATUSES = new Set<SandboxStatus>(['error', 'failed', 'destroying', 'destroyed']);
const MOUNT_POLL_INTERVAL_MS = 500;

export interface CreateOSSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /** Logical Mastra sandbox identifier. */
  id?: string;
  /** Existing CreateOS sandbox identifier to reconnect to. */
  sandboxId?: string;
  /** CreateOS shape identifier. */
  shape?: string;
  /** Root filesystem catalog name or template identifier. */
  rootfs?: string;
  /** Enable Mastra computer-use tools backed by a CreateOS desktop. */
  computerUse?: boolean | CreateOSComputerUseOptions;
  /** Display name. Defaults to a deterministic name derived from `id`. */
  sandboxName?: string;
  /** Overlay disk size in MiB. */
  diskMib?: number;
  /** Egress allowlist. */
  egress?: string[];
  /** Enable public HTTP ingress. */
  ingress?: boolean;
  /** Region in which the sandbox should run. */
  region?: string;
  /** Pause after this many idle seconds. */
  autoPauseAfterSeconds?: number;
  /** CreateOS API key. Falls back to CREATEOS_SANDBOX_API_KEY. */
  apiKey?: string;
  /** CreateOS control-plane URL. Falls back to CREATEOS_SANDBOX_BASE_URL. */
  baseUrl?: string;
  /** Authentication headers used instead of an API key. */
  authHeaders?: CreateosSandboxClientOptions['authHeaders'];
  /** Default command and API timeout in milliseconds. */
  timeout?: number;
  /** CreateOS request retry policy. */
  retry?: RetryOptions | false;
  /** Advanced: provide an already configured CreateOS client. */
  client?: CreateosSandboxClient;
}

function generateLogicalId(): string {
  return `createos-sandbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deterministicName(id: string): string {
  const readable =
    id
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 5) || 'box';
  const digest = createHash('sha256').update(id).digest('hex').slice(0, 9);
  return `mastra-${readable}-${digest}`;
}

function providerStatus(status: SandboxStatus): ProviderStatus {
  if (status === 'running') return 'running';
  if (status === 'paused') return 'stopped';
  if (status === 'destroyed' || status === 'destroying') return 'destroyed';
  if (status === 'failed' || status === 'error') return 'error';
  return 'pending';
}

export class CreateOSSandbox extends MastraSandbox<Sandbox> {
  readonly id: string;
  readonly name = 'CreateOSSandbox';
  readonly provider = 'createos';
  declare readonly mounts: MountManager;
  declare readonly computer?: SandboxComputer;
  readonly networking: SandboxNetworking = {
    getPortUrl: async port => {
      try {
        const sandbox = this._sandbox ?? (await this.lookupDetachedSandbox());
        return sandbox?.previewUrl(port) ?? null;
      } catch {
        return null;
      }
    },
  };

  status: ProviderStatus = 'pending';

  private readonly options: CreateOSSandboxOptions;
  private readonly client: CreateosSandboxClient;
  private readonly shape: string;
  private readonly rootfs?: string;
  private readonly sandboxName: string;
  private readonly timeout: number;
  private _providerSandboxId?: string;
  private _sandbox: Sandbox | null = null;
  private _createdAt: Date | null = null;
  private _recoveryPromise?: Promise<void>;

  constructor(options: CreateOSSandboxOptions = {}) {
    const timeout = options.timeout ?? 300_000;
    super({
      ...options,
      name: 'CreateOSSandbox',
      processes: new CreateOSProcessManager({ defaultTimeout: timeout }),
    });
    this.options = { ...options };
    this.id = options.id ?? generateLogicalId();
    this.shape = options.shape ?? DEFAULT_CREATEOS_SHAPE;
    const computerEnabled =
      options.computerUse === true ||
      typeof options.computerUse === 'object' ||
      (options.computerUse === undefined && options.rootfs?.startsWith('desktop:'));
    this.rootfs = options.rootfs ?? (computerEnabled ? DEFAULT_CREATEOS_DESKTOP_ROOTFS : undefined);
    this.sandboxName = options.sandboxName ?? deterministicName(this.id);
    this.timeout = timeout;
    this._providerSandboxId = options.sandboxId;

    const clientOptions: CreateosSandboxClientOptions = {
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      authHeaders: options.authHeaders,
      timeoutMs: timeout,
      retry: options.retry,
    };
    this.client = options.client ?? new CreateosSandboxClient(clientOptions);
    if (computerEnabled) {
      this.computer = new CreateOSComputer(
        this,
        typeof options.computerUse === 'object' ? options.computerUse : undefined,
      );
    }
  }

  clone(options: SandboxCloneOptions = {}): CreateOSSandbox {
    const { id: _id, sandboxId: _sandboxId, env: _env, workingDirectory: _workingDirectory, ...base } = this.options;
    return new CreateOSSandbox({
      ...base,
      ...(options.id !== undefined && { id: options.id }),
      ...(options.sandboxId !== undefined && { sandboxId: options.sandboxId }),
      ...(options.env !== undefined && { env: options.env }),
      ...(options.workingDirectory !== undefined && { workingDirectory: options.workingDirectory }),
      ...(options.idleTimeoutMinutes !== undefined && {
        autoPauseAfterSeconds: Math.max(60, Math.round(options.idleTimeoutMinutes * 60)),
      }),
    });
  }

  get createos(): Sandbox {
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);
    return this._sandbox;
  }

  /** @deprecated Use `createos` instead. */
  get instance(): Sandbox {
    return this.createos;
  }

  protected override async find(): Promise<Sandbox | undefined> {
    if (this._sandbox) return this._sandbox;
    return (await this.lookupDetachedSandbox()) ?? undefined;
  }

  protected override async connect(existing: Sandbox): Promise<void> {
    if (existing.status === 'pausing') {
      await existing.waitUntilPaused({ timeoutMs: this.timeout });
    }
    if (existing.status === 'paused' || existing.status === 'pausing') {
      await existing.resume({ timeoutMs: this.timeout });
      await existing.waitUntilRunning({ timeoutMs: this.timeout });
    } else if (existing.status === 'creating' || existing.status === 'resuming' || existing.status === 'forking') {
      await existing.waitUntilRunning({ timeoutMs: this.timeout });
    }
    if (existing.status !== 'running') {
      throw new Error(`CreateOS sandbox ${existing.id} is not runnable (status: ${existing.status})`);
    }
    this._sandbox = existing;
    this._providerSandboxId = existing.id;
    this._createdAt = new Date(existing.data.created_at);
  }

  protected override async create(): Promise<void> {
    const request: CreateSandboxRequest = {
      shape: this.shape,
      name: this.sandboxName,
      rootfs: this.rootfs,
      disk_mib: this.options.diskMib,
      egress: this.options.egress,
      ingress_enabled: this.options.ingress ?? false,
      region: this.options.region,
      auto_pause_after_seconds: this.options.autoPauseAfterSeconds,
    };
    try {
      this._sandbox = await this.client.createSandbox(request, { timeoutMs: this.timeout });
    } catch (error) {
      // A concurrent replica may have created the deterministic name first.
      if (!(error instanceof CreateosSandboxValidationError) || error.statusCode !== 409) throw error;
      const existing = await this.findByName();
      if (!existing) throw error;
      await this.connect(existing);
      return;
    }
    this._providerSandboxId = this._sandbox.id;
    this._createdAt = new Date(this._sandbox.data.created_at ?? Date.now());
  }

  async stop(): Promise<void> {
    const sandbox = this._sandbox ?? (await this.lookupDetachedSandbox());
    if (!sandbox || sandbox.status === 'paused') {
      this._sandbox = null;
      return;
    }
    try {
      await sandbox.pause({ timeoutMs: this.timeout });
      await sandbox.waitUntilPaused({ timeoutMs: this.timeout });
    } catch (error) {
      if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
    }
    this._sandbox = null;
  }

  async destroy(): Promise<void> {
    const sandbox = this._sandbox ?? (await this.lookupDetachedSandbox());
    if (sandbox) {
      try {
        await sandbox.destroy({ timeoutMs: this.timeout });
        await sandbox.waitUntilDestroyed({ timeoutMs: this.timeout });
      } catch (error) {
        if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
      }
    }
    this._sandbox = null;
    this._providerSandboxId = undefined;
  }

  async isReady(): Promise<boolean> {
    return this.status === 'running' && this._sandbox?.status === 'running';
  }

  /**
   * Run an operation against the attached sandbox and retry it once when the
   * provider reports that the sandbox disappeared or is no longer reachable.
   *
   * @internal Used by the process manager to recover stale sandbox handles.
   */
  async retryOnDead<T>(operation: (sandbox: Sandbox) => Promise<T>): Promise<T> {
    const attemptedSandbox = this.createos;
    try {
      return await operation(attemptedSandbox);
    } catch (error) {
      if (!this.isSandboxDeadError(error)) throw error;

      await this.recoverSandbox(attemptedSandbox.id);
      return operation(this.createos);
    }
  }

  getInfo(): SandboxInfo {
    const data = this._sandbox?.data;
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: data ? providerStatus(data.status) : this.status,
      createdAt: this._createdAt ?? new Date(),
      ...(data && {
        resources: {
          cpuCores: data.vcpu,
          memoryMB: data.mem_mib,
          diskMB: data.disk_mib,
        },
      }),
      mounts: [...this.mounts.entries]
        .filter(([, entry]) => entry.state === 'mounted')
        .map(([path, entry]) => ({ path, filesystem: entry.filesystem.id })),
      metadata: {
        shape: data?.shape ?? this.shape,
        sandboxName: this.sandboxName,
        ...(data?.region && { region: data.region }),
        ...(this._providerSandboxId && { sandboxId: this._providerSandboxId }),
      },
    };
  }

  getInstructions(): string {
    const workingDirectory = this.workingDirectory ? ` Default working directory: ${this.workingDirectory}.` : '';
    const desktop = this.computer ? ' Includes screenshot, mouse, keyboard, and live desktop controls.' : '';
    const mounts = this.mounts.entries.size ? ` ${this.mounts.entries.size} S3 filesystem(s) mounted.` : '';
    return `CreateOS cloud sandbox with isolated command execution.${desktop}${mounts}${workingDirectory}`;
  }

  async writeFiles(files: SandboxFileInput[]): Promise<void> {
    await this.ensureRunning();
    await Promise.all(
      files.map(file => {
        const data = typeof file.content === 'string' ? file.content : new Uint8Array(file.content);
        return this.createos.files.upload(file.path, data);
      }),
    );
  }

  /** Mount an S3-compatible WorkspaceFilesystem through CreateOS's native disk API. */
  async mount(filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    validateMountPath(mountPath);
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    const config = filesystem.getMountConfig?.() as FilesystemMountConfig | undefined;
    if (!config) {
      return this.mountFailure(filesystem, mountPath, undefined, `Filesystem "${filesystem.id}" is not mountable.`);
    }
    if (config.type !== 's3') {
      return this.mountFailure(
        filesystem,
        mountPath,
        config,
        `CreateOS native disks only support S3 mounts; received "${config.type}".`,
        'unsupported',
      );
    }

    let resolved: ResolvedCreateOSDisk;
    try {
      resolved = resolveCreateOSDisk(config as CreateOSS3MountConfig);
    } catch (error) {
      return this.mountFailure(filesystem, mountPath, config, errorToString(error));
    }

    this.mounts.set(mountPath, { filesystem, state: 'mounting', config });
    try {
      const disk = await this.findOrCreateDisk(resolved);
      const existing = (await this.createos.listDisks({ timeoutMs: this.timeout })).find(
        attachment => attachment.mount_path === mountPath,
      );
      if (existing && (existing.disk_id !== disk.id || (existing.sub_path ?? undefined) !== resolved.subPath)) {
        return this.mountFailure(
          filesystem,
          mountPath,
          config,
          `Mount path "${mountPath}" is already used by CreateOS disk "${existing.name}".`,
        );
      }
      if (!existing) {
        await this.createos.attachDisk(
          { diskId: disk.id, mountPath, ...(resolved.subPath && { subPath: resolved.subPath }) },
          { timeoutMs: this.timeout },
        );
      }

      const result = await this.waitForMount(disk.id, mountPath);
      if (!result.success) return this.mountFailure(filesystem, mountPath, config, result.error ?? 'Mount failed.');
      this.mounts.set(mountPath, { filesystem, state: 'mounted', config });
      return { success: true, mountPath };
    } catch (error) {
      const unavailable = error instanceof CreateosSandboxApiError && error.statusCode === 503;
      return this.mountFailure(
        filesystem,
        mountPath,
        config,
        errorToString(error),
        unavailable ? 'unavailable' : 'error',
      );
    }
  }

  /** Detach every CreateOS disk attachment at the requested path. */
  async unmount(mountPath: string): Promise<void> {
    validateMountPath(mountPath);
    if (!this._sandbox) throw new SandboxNotReadyError(this.id);

    const attachments = (await this.createos.listDisks({ timeoutMs: this.timeout })).filter(
      attachment => attachment.mount_path === mountPath,
    );
    for (const attachment of attachments) {
      try {
        await this.createos.detachDisk({ diskId: attachment.disk_id, mountPath }, { timeoutMs: this.timeout });
      } catch (error) {
        if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
      }
    }
    this.mounts.delete(mountPath);
  }

  private async findOrCreateDisk(resolved: ResolvedCreateOSDisk) {
    try {
      const disk = await this.client.disks.get(resolved.name, { timeoutMs: this.timeout });
      if (!sameDiskConfig(disk.config, resolved.config)) {
        throw new Error(`CreateOS disk "${resolved.name}" exists with incompatible configuration.`);
      }
      await this.client.disks.rotateCredentials(resolved.name, resolved.credentials, { timeoutMs: this.timeout });
      return disk;
    } catch (error) {
      if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
    }

    try {
      return await this.client.disks.create(
        { name: resolved.name, kind: 's3', config: resolved.config, credentials: resolved.credentials },
        { timeoutMs: this.timeout },
      );
    } catch (error) {
      if (!(error instanceof CreateosSandboxValidationError) || error.statusCode !== 409) throw error;
      const disk = await this.client.disks.get(resolved.name, { timeoutMs: this.timeout });
      if (!sameDiskConfig(disk.config, resolved.config)) throw error;
      await this.client.disks.rotateCredentials(resolved.name, resolved.credentials, { timeoutMs: this.timeout });
      return disk;
    }
  }

  private async waitForMount(diskId: string, mountPath: string): Promise<{ success: boolean; error?: string }> {
    const deadline = Date.now() + this.timeout;
    while (true) {
      const attachment = (await this.createos.listDisks({ timeoutMs: this.timeout })).find(
        item => item.disk_id === diskId && item.mount_path === mountPath,
      );
      if (attachment?.mount_status === 'mounted') return { success: true };
      if (attachment?.mount_status === 'error') {
        return { success: false, error: attachment.mount_error ?? `CreateOS failed to mount disk at "${mountPath}".` };
      }
      if (Date.now() >= deadline) {
        return { success: false, error: `Timed out waiting for CreateOS disk to mount at "${mountPath}".` };
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(MOUNT_POLL_INTERVAL_MS, deadline - Date.now())));
    }
  }

  private mountFailure(
    filesystem: WorkspaceFilesystem,
    mountPath: string,
    config: FilesystemMountConfig | undefined,
    error: string,
    state: 'error' | 'unsupported' | 'unavailable' = 'error',
  ): MountResult {
    this.mounts.set(mountPath, { filesystem, state, ...(config && { config }), error });
    return { success: false, mountPath, error, ...(state === 'unavailable' && { unavailable: true }) };
  }

  private isSandboxDeadError(error: unknown): boolean {
    if (error instanceof CreateosSandboxNotFoundError) return true;
    return (
      error instanceof CreateosSandboxApiError && error.statusCode === 503 && /sandbox has no ip/i.test(error.message)
    );
  }

  private async recoverSandbox(attemptedSandboxId: string): Promise<void> {
    if (this._recoveryPromise) {
      await this._recoveryPromise;
      return;
    }
    if (this._sandbox && this._sandbox.id !== attemptedSandboxId) {
      await this.ensureRunning();
      return;
    }

    this._recoveryPromise = this.replaceUnavailableSandbox(attemptedSandboxId).finally(() => {
      this._recoveryPromise = undefined;
    });
    await this._recoveryPromise;
  }

  private async replaceUnavailableSandbox(attemptedSandboxId: string): Promise<void> {
    // Another concurrent operation may already have replaced the stale handle.
    if (this._sandbox && this._sandbox.id !== attemptedSandboxId) return;

    this._sandbox = null;
    for (const [path, entry] of this.mounts.entries) {
      if (entry.state === 'mounted' || entry.state === 'mounting' || entry.state === 'error') {
        this.mounts.set(path, { state: 'pending', error: undefined });
      }
    }
    this.status = 'stopped';
    await this.ensureRunning();
  }

  private async lookupDetachedSandbox(): Promise<Sandbox | null> {
    if (this._providerSandboxId) {
      try {
        const sandbox = await this.client.getSandbox(this._providerSandboxId, { timeoutMs: this.timeout });
        if (!TERMINAL_STATUSES.has(sandbox.status)) return sandbox;
      } catch (error) {
        if (!(error instanceof CreateosSandboxNotFoundError)) throw error;
      }
      this._providerSandboxId = undefined;
    }
    return this.findByName();
  }

  private async findByName(): Promise<Sandbox | null> {
    const sandboxes = await this.client.listSandboxes({ timeoutMs: this.timeout });
    return (
      sandboxes.find(sandbox => sandbox.name === this.sandboxName && !TERMINAL_STATUSES.has(sandbox.status)) ?? null
    );
  }
}
