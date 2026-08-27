/**
 * E2B Desktop Sandbox Provider
 *
 * An E2B sandbox running a full Linux desktop environment with computer-use
 * (screenshot, mouse, keyboard) control. Extends `@mastra/e2b`'s `E2BSandbox`
 * the same way `@e2b/desktop`'s SDK `Sandbox` extends `e2b`'s: everything the
 * base provider supports (command execution, processes, file upload,
 * reconnection) works against the same desktop VM.
 *
 * @see https://github.com/e2b-dev/desktop
 */

import { Sandbox as E2BDesktopSdkSandbox } from '@e2b/desktop';
import type { SandboxCloneOptions, SandboxComputer } from '@mastra/core/workspace';
import { SandboxNotReadyError } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import type { E2BSandboxOptions } from '@mastra/e2b';
import type { Sandbox, SandboxConnectOpts, SandboxOpts } from 'e2b';

/**
 * E2B-hosted desktop template (`@e2b/desktop`'s default). Used when no
 * explicit `template` option is provided — unlike the base provider, no
 * template build is required.
 */
const DEFAULT_DESKTOP_TEMPLATE = 'desktop';

// =============================================================================
// E2B Desktop Sandbox Options
// =============================================================================

/**
 * E2B Desktop sandbox provider configuration.
 *
 * Inherits all `E2BSandboxOptions` (credentials, timeout, env, metadata,
 * network, template, instructions). When no `template` is provided, the
 * E2B-hosted `desktop` template is used instead of the base provider's
 * mountable template.
 */
export interface E2BDesktopSandboxOptions extends E2BSandboxOptions {
  /**
   * Desktop display resolution as `[width, height]` in pixels.
   * Applies to newly created sandboxes only.
   */
  resolution?: [number, number];
  /**
   * Desktop display DPI.
   * Applies to newly created sandboxes only.
   */
  dpi?: number;
}

// =============================================================================
// E2B Desktop Sandbox Implementation
// =============================================================================

/**
 * E2B Desktop sandbox provider for Mastra workspaces.
 *
 * Features:
 * - Everything from `E2BSandbox` (commands, processes, file upload, pause/resume)
 * - `computer` capability: screenshot, mouse, and keyboard control — when
 *   used in a `Workspace`, agents automatically get the
 *   `mastra_workspace_computer_*` tools
 * - Live desktop view via an authenticated noVNC stream URL
 *
 * @example Basic usage
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { Workspace } from '@mastra/core/workspace';
 * import { E2BDesktopSandbox } from '@mastra/e2b-desktop';
 *
 * const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720] });
 * const agent = new Agent({
 *   // file + shell + computer tools are all emitted automatically
 *   workspace: new Workspace({ sandbox }),
 *   // ...
 * });
 * ```
 *
 * @example Direct desktop control
 * ```typescript
 * const sandbox = new E2BDesktopSandbox();
 * await sandbox.start();
 * await sandbox.computer.leftClick(100, 200);
 * const { data } = await sandbox.computer.screenshot();
 * const viewerUrl = await sandbox.computer.streamUrl();
 * ```
 */
export class E2BDesktopSandbox extends E2BSandbox {
  override readonly name: string = 'E2BDesktopSandbox';
  override readonly provider: string = 'e2b-desktop';

  private readonly resolution?: [number, number];
  private readonly dpi?: number;
  private readonly _desktopConstructorOptions: E2BDesktopSandboxOptions;

  /** Stream startup memo, keyed by SDK sandbox ID so a fresh VM restarts it. */
  private _streamStarted: { sandboxId: string; promise: Promise<void> } | null = null;

  constructor(options: E2BDesktopSandboxOptions = {}) {
    super(options);
    this.resolution = options.resolution;
    this.dpi = options.dpi;
    this._desktopConstructorOptions = { ...options };
  }

  /**
   * Computer-use (desktop) capability: screenshot, mouse, and keyboard
   * control of the sandbox's desktop, backed by `@e2b/desktop`.
   * Operations start the sandbox automatically if it is not running.
   */
  override readonly computer: SandboxComputer = {
    screenshot: async () => {
      const data = await this.withDesktop(desktop => desktop.screenshot());
      return { data, mediaType: 'image/png' as const };
    },
    leftClick: async (x, y) => {
      await this.withDesktop(desktop => desktop.leftClick(x, y));
    },
    rightClick: async (x, y) => {
      await this.withDesktop(desktop => desktop.rightClick(x, y));
    },
    doubleClick: async (x, y) => {
      await this.withDesktop(desktop => desktop.doubleClick(x, y));
    },
    moveMouse: async (x, y) => {
      await this.withDesktop(desktop => desktop.moveMouse(x, y));
    },
    drag: async (from, to) => {
      await this.withDesktop(desktop => desktop.drag([from.x, from.y], [to.x, to.y]));
    },
    scroll: async (direction, amount) => {
      await this.withDesktop(desktop => desktop.scroll(direction, amount));
    },
    type: async text => {
      await this.withDesktop(desktop => desktop.write(text));
    },
    press: async key => {
      await this.withDesktop(desktop => desktop.press(key));
    },
    getScreenSize: async () => {
      return this.withDesktop(desktop => desktop.getScreenSize());
    },
    getCursorPosition: async () => {
      return this.withDesktop(desktop => desktop.getCursorPosition());
    },
    streamUrl: async () => {
      try {
        return await this.withDesktop(async desktop => {
          await this.ensureStreamStarted(desktop);
          try {
            return desktop.stream.getUrl({ authKey: desktop.stream.getAuthKey() });
          } catch {
            // Stream was started externally without auth — return the plain URL.
            return desktop.stream.getUrl();
          }
        });
      } catch {
        return null;
      }
    },
  };

  /**
   * Get the underlying `@e2b/desktop` Sandbox instance for direct access to
   * desktop APIs not exposed through the abstraction (e.g. `launch()`,
   * `open()`, window helpers, custom stream control).
   *
   * @throws {SandboxNotReadyError} If the sandbox has not been started
   *
   * @example Launch an application
   * ```typescript
   * await sandbox.start();
   * await sandbox.desktop.launch('xfce4-terminal');
   * await sandbox.desktop.open('https://mastra.ai');
   * ```
   */
  get desktop(): E2BDesktopSdkSandbox {
    if (!this._sandbox) {
      throw new SandboxNotReadyError(this.id);
    }
    // Safe: the factory hooks below guarantee the SDK sandbox is a desktop sandbox.
    return this._sandbox as E2BDesktopSdkSandbox;
  }

  /**
   * Construct a sibling `E2BDesktopSandbox` that inherits this sandbox's
   * configuration with per-instance overrides. See `E2BSandbox.clone`.
   */
  override clone(options: SandboxCloneOptions = {}): E2BDesktopSandbox {
    const { id: _id, ...base } = this._desktopConstructorOptions;
    return new E2BDesktopSandbox({
      ...base,
      ...(options.id !== undefined && { id: options.id }),
      ...(options.env !== undefined && { env: options.env }),
      ...(options.idleTimeoutMinutes !== undefined && { timeout: options.idleTimeoutMinutes * 60_000 }),
    });
  }

  // ---------------------------------------------------------------------------
  // SDK Factory Hooks
  // ---------------------------------------------------------------------------

  /** Create a `@e2b/desktop` SDK sandbox (with desktop display options). */
  protected override async createSdkSandbox(templateId: string, opts: SandboxOpts): Promise<Sandbox> {
    return E2BDesktopSdkSandbox.create(templateId, {
      ...opts,
      ...(this.resolution && { resolution: this.resolution }),
      ...(this.dpi !== undefined && { dpi: this.dpi }),
    });
  }

  /** Connect to an existing `@e2b/desktop` SDK sandbox. */
  protected override async connectSdkSandbox(sandboxId: string, opts: SandboxConnectOpts): Promise<Sandbox> {
    return E2BDesktopSdkSandbox.connect(sandboxId, opts);
  }

  // ---------------------------------------------------------------------------
  // Template Resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolve the template: without an explicit `template` option, use the
   * E2B-hosted desktop template (no build needed). Explicit templates go
   * through the base provider's resolution (ID, builder, or customizer).
   */
  protected override async resolveTemplate(): Promise<string> {
    if (this._resolvedTemplateId) {
      return this._resolvedTemplateId;
    }
    if (!this.templateSpec) {
      this._resolvedTemplateId = DEFAULT_DESKTOP_TEMPLATE;
      return this._resolvedTemplateId;
    }
    return super.resolveTemplate();
  }

  /**
   * The default desktop template is E2B-hosted — there is nothing to build.
   * (Only reached from the template-not-found retry path in `start()`.)
   */
  protected override async buildDefaultTemplate(): Promise<string> {
    this._resolvedTemplateId = DEFAULT_DESKTOP_TEMPLATE;
    return this._resolvedTemplateId;
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  /** Ensure the sandbox is running, then run a desktop SDK operation. */
  private async withDesktop<T>(fn: (desktop: E2BDesktopSdkSandbox) => Promise<T>): Promise<T> {
    await this.ensureRunning();
    return this.retryOnDead(() => fn(this.desktop));
  }

  /**
   * Ensure the VNC stream is running (authenticated), memoized per SDK
   * sandbox so a resumed/recreated VM restarts it. A stream already started
   * externally (via the `desktop` escape hatch) is left untouched.
   */
  private async ensureStreamStarted(desktop: E2BDesktopSdkSandbox): Promise<void> {
    if (this._streamStarted?.sandboxId !== desktop.sandboxId) {
      const promise = desktop.stream.start({ requireAuth: true }).catch((error: unknown) => {
        if (String(error).includes('already running')) {
          return;
        }
        this._streamStarted = null;
        throw error;
      });
      this._streamStarted = { sandboxId: desktop.sandboxId, promise };
    }
    return this._streamStarted.promise;
  }
}
