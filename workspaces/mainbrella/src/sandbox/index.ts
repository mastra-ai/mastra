import { randomUUID } from 'node:crypto';
import posix from 'node:path/posix';

import { Mainbrella, MainbrellaError } from '@mainbrella/sdk';
import type { Capabilities, Container, ContainerIdentity, MachineSize, PreviewLink, Sandbox } from '@mainbrella/sdk';
import { MastraSandbox, SandboxNotReadyError, assertModesUnsupported } from '@mastra/core/workspace';
import type {
  MastraSandboxOptions,
  ProviderStatus,
  SandboxCloneOptions,
  SandboxFileInput,
  SandboxInfo,
  SandboxNetworking,
  SandboxStartResult,
  WriteFilesOptions,
} from '@mastra/core/workspace';

import { MainbrellaProcessManager } from './process-manager';

export interface MainbrellaSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  id?: string;
  /** Server-side API key. Defaults to MAINBRELLA_API_KEY. */
  apiKey?: string;
  /** HTTPS API origin, or HTTP localhost for development. Defaults to MAINBRELLA_API_URL. */
  apiUrl?: string;
  /** Advertised runtime catalog ID. Defaults to node. */
  catalogId?: string;
  /** Account-owned ready custom image. Mutually exclusive with catalogId and workspaceId. */
  imageId?: string;
  /** Restore a saved filesystem into a fresh generation. */
  workspaceId?: string;
  size?: MachineSize;
  internet?: boolean;
  /** Reconnect to this exact running generation. A stopped generation is never replaced automatically. */
  container?: ContainerIdentity;
  /** Persist this key to recover ambiguous creation with the same options within 24 hours. */
  creationKey?: string;
  /** Maximum wait for provisioning, in milliseconds. Defaults to 120000. */
  startupTimeout?: number;
  /** Default managed command timeout, in milliseconds. Defaults to 30000, at most 900000. */
  timeout?: number;
  /** Custom HTTP transport, for example for tests. */
  fetch?: typeof fetch;
}

/** Ephemeral Linux sandbox bound to an exact Mainbrella container generation. */
export class MainbrellaSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'MainbrellaSandbox';
  readonly provider = 'mainbrella';
  declare readonly processes: MainbrellaProcessManager;
  status: ProviderStatus = 'pending';

  private readonly options: MainbrellaSandboxOptions;
  private _client?: Mainbrella;
  private _mainbrella?: Sandbox;
  private _container?: ContainerIdentity;
  private _creationKey: string;
  private creationPending = false;
  private capabilitiesPromise?: Promise<Capabilities>;
  private containerInfo?: Container;
  private readonly previews = new Map<number, Promise<PreviewLink>>();

  readonly networking: SandboxNetworking = {
    getPortUrl: async port => {
      if (!this._mainbrella || !(await this.getCapabilities()).previews.supported) return null;
      // Keep failed issuance promises: a lost response must be reconciled via
      // previews.list/revoke, rather than minting another bearer link on retry.
      let pending = this.previews.get(port);
      if (pending) {
        const previous = await pending;
        if (previous.expiresAt > Date.now()) return previous.url;
      }
      pending = this._mainbrella.previews.create(port);
      this.previews.set(port, pending);
      return (await pending).url;
    },
  };

  constructor(options: MainbrellaSandboxOptions = {}) {
    const timeout = options.timeout ?? 30_000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 900_000) {
      throw new RangeError('Mainbrella timeout must be an integer between 1 and 900000 milliseconds');
    }
    if ([options.catalogId, options.imageId, options.workspaceId].filter(value => value !== undefined).length > 1) {
      throw new Error('Specify only one of catalogId, imageId, or workspaceId');
    }
    if (
      options.startupTimeout !== undefined &&
      (!Number.isInteger(options.startupTimeout) || options.startupTimeout < 1)
    ) {
      throw new RangeError('Mainbrella startupTimeout must be a positive integer');
    }
    if (options.creationKey !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(options.creationKey)) {
      throw new Error('Invalid Mainbrella creationKey');
    }
    super({
      ...options,
      name: 'MainbrellaSandbox',
      workingDirectory: options.workingDirectory ?? '/workspace',
      processes: new MainbrellaProcessManager({ defaultTimeout: timeout }),
    });
    this.id = options.id ?? `mainbrella-${randomUUID()}`;
    this.options = { ...options, container: options.container && { ...options.container } };
    this._container = options.container && { ...options.container };
    this._creationKey = options.creationKey ?? randomUUID();
  }

  get client(): Mainbrella {
    return (this._client ??= new Mainbrella({
      apiKey: this.options.apiKey ?? process.env.MAINBRELLA_API_KEY ?? '',
      baseUrl: this.options.apiUrl ?? process.env.MAINBRELLA_API_URL,
      fetch: this.options.fetch,
    }));
  }

  /** Underlying SDK handle for saves, exports, previews, and other provider APIs. */
  get mainbrella(): Sandbox {
    if (!this._mainbrella) throw new SandboxNotReadyError(this.id);
    return this._mainbrella;
  }

  /** Save both fields for reconnecting and generation-qualified cleanup. */
  get container(): ContainerIdentity | undefined {
    return this._container && { ...this._container };
  }

  get creationKey(): string {
    return this._creationKey;
  }

  async getCapabilities(): Promise<Capabilities> {
    if (!this.capabilitiesPromise) {
      this.capabilitiesPromise = this.client.capabilities().catch(error => {
        this.capabilitiesPromise = undefined;
        throw error;
      });
    }
    return this.capabilitiesPromise;
  }

  async start(): Promise<SandboxStartResult> {
    const capabilities = await this.getCapabilities();
    if (!capabilities.execution.background || !capabilities.execution.cancellation) {
      throw new MainbrellaError('managed_execution_unavailable');
    }
    if (this._container) {
      const state = await this.client.list();
      const existing = state.containers.find(
        candidate => candidate.id === this._container!.id && candidate.createdAt === this._container!.createdAt,
      );
      if (!existing || existing.status !== 'running') throw new MainbrellaError('container_not_running', 409);
      this.containerInfo = existing;
      this._mainbrella = this.client.connect(existing);
      return { outcome: 'connected' };
    }

    this.creationPending = true;
    let sandbox: Sandbox;
    try {
      sandbox = await this.client.create({
        ...(this.options.workspaceId
          ? { workspaceId: this.options.workspaceId }
          : this.options.imageId
            ? { imageId: this.options.imageId }
            : { catalogId: this.options.catalogId ?? 'node' }),
        size: this.options.size,
        internet: this.options.internet,
        idempotencyKey: this._creationKey,
        waitTimeoutMs: this.options.startupTimeout ?? 120_000,
      });
    } catch (error) {
      // Admission rejections with a definitive HTTP result need no cleanup.
      // Transport errors and post-creation confirmation failures remain unresolved.
      if (
        error instanceof MainbrellaError &&
        (['network_policy_unavailable', 'persistence_unavailable'].includes(error.code) ||
          (error.status >= 400 &&
            error.status !== 503 &&
            !['network_policy_unconfirmed', 'workspace_restore_unconfirmed', 'idempotency_key_conflict'].includes(
              error.code,
            )))
      ) {
        this.creationPending = false;
      }
      throw error;
    }
    // Adopt before any further I/O so cleanup can still target this generation
    // if a subsequent status query or onStart hook fails.
    this._mainbrella = sandbox;
    this._container = { id: sandbox.id, createdAt: sandbox.createdAt };
    this.creationPending = false;
    return { outcome: 'created' };
  }

  async isReady(): Promise<boolean> {
    if (this.status !== 'running' || !this._container) return false;
    const state = await this.client.list();
    const current = state.containers.find(
      candidate => candidate.id === this._container!.id && candidate.createdAt === this._container!.createdAt,
    );
    this.containerInfo = current;
    return current?.status === 'running';
  }

  /** Stop discards unsaved filesystem changes. A later start creates a new generation. */
  async stop(): Promise<void> {
    if (!this._container) {
      if (this.creationPending) {
        throw new MainbrellaError('creation_unresolved', 0, { idempotencyKey: this._creationKey });
      }
      this.status = 'stopped';
      return;
    }
    try {
      await this.client.connect(this._container).kill();
    } catch (error) {
      if (!(error instanceof MainbrellaError) || error.status !== 409) throw error;
      const state = await this.client.list();
      if (
        state.containers.some(
          candidate => candidate.id === this._container!.id && candidate.createdAt === this._container!.createdAt,
        )
      ) {
        throw error;
      }
    }
    this.processes.detach();
    this.previews.clear();
    this._container = undefined;
    this._mainbrella = undefined;
    this.containerInfo = undefined;
    this._creationKey = randomUUID();
    this.status = 'stopped';
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.status = 'destroyed';
  }

  clone(options: SandboxCloneOptions = {}): MainbrellaSandbox {
    if (options.sandboxId || options.idleTimeoutMinutes !== undefined) {
      throw new Error('Mainbrella clone does not support sandboxId or configurable idle timeouts');
    }
    const { id: _id, container: _container, creationKey: _creationKey, ...config } = this.options;
    return new MainbrellaSandbox({ ...config, id: options.id, env: options.env ?? this.getEnv() });
  }

  async writeFiles(files: SandboxFileInput[], options?: WriteFilesOptions): Promise<void> {
    assertModesUnsupported(files, 'mainbrella');
    options?.abortSignal?.throwIfAborted();
    await this.ensureRunning();
    const capabilities = await this.getCapabilities();
    if (!capabilities.files.write || !capabilities.files.mkdir) throw new MainbrellaError('files_unavailable');
    for (const file of files) {
      options?.abortSignal?.throwIfAborted();
      const path = posix.resolve(this.workingDirectory ?? '/workspace', file.path);
      const bytes = typeof file.content === 'string' ? Buffer.from(file.content) : file.content;
      if (bytes.byteLength > capabilities.files.maxFileBytes) throw new MainbrellaError('file_too_large', 413);
      await this.mainbrella.files.mkdir(posix.dirname(path), { recursive: true });
      await this.mainbrella.files.write(path, bytes);
    }
  }

  async getInfo(): Promise<SandboxInfo> {
    if (this._container) {
      const state = await this.client.list();
      this.containerInfo = state.containers.find(
        candidate => candidate.id === this._container!.id && candidate.createdAt === this._container!.createdAt,
      );
    }
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: new Date(this._container?.createdAt ?? 0),
      timeoutAt: this.containerInfo?.expiresAt ? new Date(this.containerInfo.expiresAt) : undefined,
      metadata: { container: this.container, catalogId: this.options.catalogId, size: this.containerInfo?.size },
    };
  }

  getInstructions(): string {
    return `Commands run in a Mainbrella Linux container, in ${this.workingDirectory}. Managed jobs run for at most 15 minutes, within the container lease. Unsaved files are lost on stop. Files are limited to 1 MiB and command output to 1 MiB. Cloud storage mounts and filesystem watchers are unsupported.`;
  }
}
