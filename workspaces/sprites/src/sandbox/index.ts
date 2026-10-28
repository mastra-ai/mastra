/**
 * Fly.io Sprites Sandbox Provider
 *
 * A Sprites sandbox implementation for Mastra workspaces. Gets or creates a
 * persistent Fly.io Sprite by name and runs commands in it through the
 * official `@fly/sprites` SDK. Sprites keep their filesystem between runs and
 * hibernate on their own when idle.
 *
 * @see https://sprites.dev
 */

import { APIError, SpritesClient } from '@fly/sprites';
import type { Sprite, SpriteConfig } from '@fly/sprites';
import type {
  InstructionsOption,
  MastraSandboxOptions,
  ProviderStatus,
  SandboxInfo,
  SandboxStartResult,
} from '@mastra/core/workspace';
import { MastraSandbox, SandboxNotReadyError } from '@mastra/core/workspace';
import { LOG_PREFIX, SpritesProcessManager } from './process-manager';

export interface SpritesSandboxOptions extends Omit<MastraSandboxOptions, 'processes'> {
  /**
   * Sprite name, also used as the sandbox id. An existing Sprite with this
   * name is reused (including its filesystem); otherwise one is created.
   * Generated when omitted.
   */
  id?: string;
  /** Sprites API token. Falls back to the `SPRITES_TOKEN` environment variable. */
  token?: string;
  /** Sprites API base URL. Defaults to the SDK default (`https://api.sprites.dev`). */
  baseURL?: string;
  /** Machine configuration applied only when the Sprite is created. */
  spriteConfig?: SpriteConfig;
  /** Default command timeout in milliseconds. Per-command `timeout` wins. */
  timeout?: number;
  /** Override or extend the default agent instructions for this sandbox. */
  instructions?: InstructionsOption;
}

export class SpritesSandbox extends MastraSandbox {
  readonly id: string;
  readonly name = 'SpritesSandbox';
  readonly provider = 'sprites';
  status: ProviderStatus = 'pending';

  declare readonly processes: SpritesProcessManager;

  private _client: SpritesClient | null = null;
  private _sprite: Sprite | null = null;
  private _createdAt: Date | null = null;
  private readonly _token?: string;
  private readonly _baseURL?: string;
  private readonly _spriteConfig?: SpriteConfig;
  private readonly _timeout?: number;
  private readonly _instructionsOverride?: InstructionsOption;

  constructor(options: SpritesSandboxOptions = {}) {
    super({ ...options, name: 'SpritesSandbox', processes: new SpritesProcessManager() });

    this.id = options.id ?? `mastra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._token = options.token ?? process.env.SPRITES_TOKEN;
    this._baseURL = options.baseURL;
    this._spriteConfig = options.spriteConfig;
    this._timeout = options.timeout;
    this._instructionsOverride = options.instructions;
  }

  /** The underlying SDK `Sprite`. Throws if the sandbox has not been started. */
  get sprite(): Sprite {
    if (!this._sprite) {
      throw new SandboxNotReadyError(this.id);
    }
    return this._sprite;
  }

  /** Default command timeout in milliseconds, if configured. */
  get defaultTimeout(): number | undefined {
    return this._timeout;
  }

  private get client(): SpritesClient {
    if (!this._client) {
      if (!this._token) {
        throw new Error(
          `${LOG_PREFIX} Missing Sprites API token. Pass \`token\` or set the SPRITES_TOKEN environment variable.`,
        );
      }
      this._client = new SpritesClient(this._token, this._baseURL ? { baseURL: this._baseURL } : undefined);
    }
    return this._client;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Get the Sprite named `id`, creating it when it does not exist.
   * Reports `outcome: 'created'` only when a new Sprite was provisioned.
   */
  async start(): Promise<SandboxStartResult> {
    if (this._sprite) {
      return { outcome: 'connected' };
    }

    const client = this.client;
    let outcome: SandboxStartResult['outcome'] = 'connected';
    let sprite: Sprite;

    try {
      sprite = await client.getSprite(this.id);
    } catch (error) {
      if (!isStatus(error, 404)) throw error;
      try {
        sprite = await client.createSprite(this.id, this._spriteConfig);
        outcome = 'created';
      } catch (createError) {
        // Another process created the same Sprite between our get and create.
        if (!isStatus(createError, 409)) throw createError;
        sprite = await client.getSprite(this.id);
      }
    }

    this._sprite = sprite;
    this._createdAt = sprite.createdAt ?? new Date();
    this.logger.debug(`${LOG_PREFIX} Sprite ready`, { id: this.id, outcome });
    return { outcome };
  }

  /**
   * Release local resources: kill background processes started by this
   * instance and close the SDK control connection.
   *
   * The Sprite itself is NOT deleted or suspended. Sprites hibernate on their
   * own when idle, and `start()` reconnects to the same filesystem.
   */
  async stop(): Promise<void> {
    await this._killTrackedProcesses();
    this._sprite?.closeControlConnection();
    this._sprite = null;
  }

  /**
   * Permanently delete the Sprite and its filesystem. A Sprite that no longer
   * exists is treated as already destroyed.
   */
  async destroy(): Promise<void> {
    await this._killTrackedProcesses();
    const sprite = this._sprite ?? this.client.sprite(this.id);
    sprite.closeControlConnection();
    this._sprite = null;

    try {
      await sprite.delete();
    } catch (error) {
      if (!isStatus(error, 404)) throw error;
    }
  }

  /**
   * Capture a checkpoint of the Sprite's current state.
   *
   * Checkpoints live inside this Sprite only and cannot seed other sandboxes,
   * so `supportsCheckpoints` stays `false`.
   */
  async snapshot(): Promise<void> {
    await this.ensureRunning();
    const stream = await this.sprite.createCheckpoint('mastra snapshot');
    await stream.processAll(message => {
      if (message.type === 'error') {
        throw new Error(`${LOG_PREFIX} Checkpoint failed: ${message.error ?? message.data ?? 'unknown error'}`);
      }
    });
  }

  private async _killTrackedProcesses(): Promise<void> {
    await this.processes.killAll().catch(error => {
      this.logger.warn(`${LOG_PREFIX} Failed to kill background processes`, { error });
    });
  }

  // ---------------------------------------------------------------------------
  // Info & Instructions
  // ---------------------------------------------------------------------------

  async getInfo(): Promise<SandboxInfo> {
    const sprite = this._sprite;
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      createdAt: this._createdAt ?? new Date(),
      metadata: {
        ...(sprite && {
          ...(sprite.id && { spriteId: sprite.id }),
          ...(sprite.status && { spriteStatus: sprite.status }),
          ...(sprite.url && { url: sprite.url }),
          ...(sprite.primaryRegion && { region: sprite.primaryRegion }),
        }),
      },
    };
  }

  getInstructions(): string {
    const defaultInstructions = this._buildDefaultInstructions();

    if (typeof this._instructionsOverride === 'string') {
      return this._instructionsOverride;
    }
    if (typeof this._instructionsOverride === 'function') {
      return this._instructionsOverride({ defaultInstructions });
    }
    return defaultInstructions;
  }

  private _buildDefaultInstructions(): string {
    const parts = [
      'Fly.io Sprite: a persistent Linux VM. Files written to disk survive between sessions.',
      this.workingDirectory
        ? `Commands run in ${this.workingDirectory} by default.`
        : 'Commands run in the Sprite user home directory by default.',
    ];
    if (this._timeout !== undefined) {
      parts.push(`Default command timeout: ${Math.ceil(this._timeout / 1000)}s.`);
    }
    return parts.join(' ');
  }
}

function isStatus(error: unknown, statusCode: number): boolean {
  return error instanceof APIError && error.statusCode === statusCode;
}
