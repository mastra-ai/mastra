/**
 * BrowserViewer - CLI-based browser provider
 *
 * Extends MastraBrowser to provide browser capabilities via CLI tools
 * (agent-browser, playwright-cli, browser-use, etc.) rather than SDK automation.
 *
 * The CLI handles browser launch/lifecycle. BrowserViewer:
 * - Gets CDP URL from the CLI (e.g., `agent-browser get cdp-url`)
 * - Provides screencast streaming (via CDP Page.screencastFrame)
 * - Reads current URL/title (via CDP Runtime.evaluate)
 * - Injects input for interactive viewing (via CDP Input.*)
 *
 * Unlike SDK providers (AgentBrowser, StagehandBrowser), BrowserViewer:
 * - Does NOT launch the browser (CLI handles that via skills)
 * - Does NOT provide automation tools (agent uses execute_command + skills)
 * - Connects to an already-running browser launched by the CLI
 */

import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import type { Tool } from '../tools/tool';
import { commandExists } from '../workspace/sandbox/native-sandbox/detect';
import type { ProcessHandle, SandboxProcessManager } from '../workspace/sandbox/process-manager';
import { MastraBrowser } from './browser';
import type { BrowserConfigBase, MouseEventParams, KeyboardEventParams } from './browser';
import { ScreencastStream } from './screencast/screencast-stream';
import type { CdpSessionLike, CdpSessionProvider, ScreencastOptions } from './screencast/types';
import type { BrowserState, BrowserTabState } from './thread-manager';
import { BrowserViewerThreadManager } from './viewer-thread-manager';
import type { ThreadCdpConnection } from './viewer-thread-manager';

// ---------------------------------------------------------------------------
// Page Target Types (for multi-tab tracking)
// ---------------------------------------------------------------------------

/**
 * Information about a page target tracked by BrowserViewer.
 */
export interface PageTarget {
  /** CDP target ID */
  targetId: string;
  /** CDP session ID for this target (obtained via Target.attachToTarget) */
  sessionId?: string;
  /** Current URL */
  url: string;
  /** Page title */
  title?: string;
  /** Target type (should be 'page') */
  type: string;
}

/**
 * CDP TargetInfo structure returned by Target events.
 */
interface CdpTargetInfo {
  targetId: string;
  type: string;
  title: string;
  url: string;
  attached?: boolean;
  canAccessOpener?: boolean;
  browserContextId?: string;
}

// ---------------------------------------------------------------------------
// CLI Provider Types
// ---------------------------------------------------------------------------

/**
 * Built-in CLI providers that BrowserViewer knows how to get CDP URL from.
 */
export type BuiltInCLIProvider = 'agent-browser' | 'browser-use';

/**
 * Custom CLI provider configuration.
 */
export interface CustomCLIProvider {
  /** Command to get the CDP URL (e.g., 'my-browser get cdp-url') */
  getCdpUrlCommand: string;

  /** Optional: Command to check if CLI is installed */
  checkCommand?: string;

  /** Optional: Command to install the CLI */
  installCommand?: string;
}

/**
 * CLI provider configuration.
 */
export type CLIProvider = BuiltInCLIProvider | CustomCLIProvider;

/**
 * Commands for built-in CLI providers.
 * Each command has a direct form and an npx fallback.
 * We try the direct command first (faster if globally installed),
 * then fall back to npx if not found.
 */
export const CLI_PROVIDER_COMMANDS: Record<
  BuiltInCLIProvider,
  {
    /** The CLI binary name (for checking if installed) */
    binary: string;
    /** npx package name (for fallback) */
    npxPackage: string;
    /** Arguments to get CDP URL */
    getCdpUrlArgs: string[];
    /** Base arguments to open/launch browser (without headless flags) */
    openArgs: string[];
    /** Argument to enable headed (visible) mode, if supported */
    headedArg?: string;
    /** Arguments to check version */
    checkArgs: string[];
    /** Install command */
    install: string;
  }
> = {
  'agent-browser': {
    binary: 'agent-browser',
    npxPackage: 'agent-browser',
    getCdpUrlArgs: ['get', 'cdp-url'],
    openArgs: ['open'],
    headedArg: '--headed',
    checkArgs: ['--version'],
    install: 'npm install -g agent-browser',
  },
  'browser-use': {
    binary: 'browser-use',
    npxPackage: 'browser-use', // Python - npx won't work, but kept for consistency
    getCdpUrlArgs: [], // No direct command; uses process discovery fallback
    openArgs: ['open'],
    headedArg: '--headed',
    checkArgs: ['--help'],
    install: 'python3 -m pipx install browser-use',
  },
};

/**
 * Skill repositories for built-in CLI providers.
 * Install with: npx skills add <repo> --skill <skill>
 */
export const CLI_SKILL_REPOS: Record<BuiltInCLIProvider, { repo: string; skill: string }> = {
  'agent-browser': {
    repo: 'vercel-labs/agent-browser',
    skill: 'agent-browser',
  },
  'browser-use': {
    repo: 'browser-use/browser-use',
    skill: 'browser-use',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserViewerConfig extends BrowserConfigBase {
  /**
   * CLI provider for browser automation.
   * BrowserViewer will get the CDP URL from this CLI.
   */
  cli?: CLIProvider;

  /**
   * Command executor for running CLI commands.
   * If not provided, will use child_process.exec directly.
   * Useful for running commands in a sandbox environment.
   */
  execCommand?: (command: string) => Promise<{ stdout: string; stderr: string }>;

  /**
   * Process manager for spawning and tracking browser processes.
   * When provided, the browser CLI is spawned as a tracked background process,
   * enabling proper CDP port discovery and thread isolation.
   */
  processManager?: SandboxProcessManager;
}

export interface BrowserViewerEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  error: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Simple CDP Client (WebSocket-based)
// ---------------------------------------------------------------------------

/**
 * A minimal CDP client that wraps a WebSocket connection.
 * Implements CdpSessionLike for compatibility with ScreencastStream.
 */
class CdpClient extends EventEmitter implements CdpSessionLike {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this._isConnected = true;
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());

            // Handle response to a command
            if (message.id !== undefined) {
              const pending = this.pendingMessages.get(message.id);
              if (pending) {
                this.pendingMessages.delete(message.id);
                if (message.error) {
                  pending.reject(new Error(message.error.message || 'CDP error'));
                } else {
                  pending.resolve(message.result);
                }
              }
            }

            // Handle events
            if (message.method) {
              // Include sessionId in event params for flattened protocol filtering
              const eventParams = message.sessionId
                ? { ...message.params, sessionId: message.sessionId }
                : message.params;
              this.emit(message.method, eventParams);
            }
          } catch {
            // Ignore parse errors
          }
        });

        this.ws.on('close', () => {
          this._isConnected = false;
          // Reject all pending messages
          for (const [, pending] of this.pendingMessages) {
            pending.reject(new Error('Connection closed'));
          }
          this.pendingMessages.clear();
          this.emit('close');
        });

        this.ws.on('error', (error: Error) => {
          if (!this._isConnected) {
            reject(error);
          }
          this.emit('error', error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || !this._isConnected) {
      throw new Error('Not connected');
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });

      // Extract sessionId from params if present (for flattened protocol)
      // sessionId goes at the message level, not inside params
      const { sessionId, ...restParams } = params || {};
      const messageObj: Record<string, unknown> = { id, method };

      // Only add params if there are any remaining
      if (Object.keys(restParams).length > 0) {
        messageObj.params = restParams;
      }

      // Add sessionId at message level for flattened protocol
      if (sessionId) {
        messageObj.sessionId = sessionId;
      }

      const message = JSON.stringify(messageObj);
      this.ws!.send(message, error => {
        if (error) {
          this.pendingMessages.delete(id);
          reject(error);
        }
      });
    });
  }

  async detach(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
  }

  // EventEmitter methods are inherited
}

// ---------------------------------------------------------------------------
// BrowserViewer
// ---------------------------------------------------------------------------

/**
 * CLI-based browser provider that extends MastraBrowser.
 *
 * Unlike SDK providers (AgentBrowser, StagehandBrowser), BrowserViewer:
 * - Connects to a browser launched externally by a CLI (agent-browser, etc.)
 * - Does NOT launch the browser itself (CLI handles that via skills)
 * - Does NOT provide automation tools (agent uses execute_command + skills)
 *
 * It provides the same screencast/observation capabilities as SDK providers:
 * - CDP URL retrieval from CLI providers
 * - Screencast streaming
 * - Reading current URL/title
 * - Input injection (mouse/keyboard)
 */
/**
 * Per-thread browser state for BrowserViewer.
 * In 'browser' isolation mode, each thread has its own state.
 * In 'none' mode, all threads share the same state.
 */
interface ThreadBrowserState {
  /** CDP client for this thread's browser */
  cdpClient: CdpClient | null;
  /** CDP URL for this thread's browser */
  cdpUrl: string | null;
  /** Browser process handle (if spawned) */
  processHandle: ProcessHandle | null;
  /** Screencast stream for this thread */
  screencastStream: ScreencastStream | null;
  /** Multi-tab tracking: targetId -> PageTarget */
  pageTargets: Map<string, PageTarget>;
  /** Currently active target ID */
  activeTargetId: string | null;
  /** Debounce timers */
  tabChangeDebounceTimer: ReturnType<typeof setTimeout> | null;
  targetInfoDebounceTimer: ReturnType<typeof setTimeout> | null;
  /** Last known URL (fallback) */
  lastUrl?: string;
}

export class BrowserViewer extends MastraBrowser implements CdpSessionProvider {
  // ---------------------------------------------------------------------------
  // MastraBrowser Identity (required abstract properties)
  // ---------------------------------------------------------------------------

  readonly id: string;
  readonly name: string = 'BrowserViewer';
  readonly provider: string = 'cli';

  // ---------------------------------------------------------------------------
  // BrowserViewer-specific state
  // ---------------------------------------------------------------------------

  private viewerConfig: BrowserViewerConfig;
  private browserPollTimer: ReturnType<typeof setTimeout> | null = null;
  private _isPollingForBrowser = false;

  // ---------------------------------------------------------------------------
  // Thread isolation
  // ---------------------------------------------------------------------------

  /** Thread manager for browser isolation */
  declare protected threadManager: BrowserViewerThreadManager;

  /** Per-thread browser state (for 'browser' isolation mode) */
  private threadStates = new Map<string, ThreadBrowserState>();

  /** Shared browser state (for 'none' isolation mode) */
  private sharedState: ThreadBrowserState | null = null;

  constructor(config: BrowserViewerConfig = {}) {
    // Extract base config properties for MastraBrowser
    // BrowserViewer manages CDP connection itself, so we pass scope only
    super({ scope: config.scope });
    this.viewerConfig = config;
    this.id = `browser-viewer-${Date.now()}`;

    // Initialize thread manager
    this.threadManager = new BrowserViewerThreadManager({
      scope: config.scope ?? 'thread',
      viewerConfig: config,
      processManager: config.processManager,
      cli: config.cli,
      logger: this.logger,
      discoverCdpUrl: config.processManager ? this.discoverCdpFromProcess.bind(this) : undefined,
      onBrowserCreated: async (connection, threadId) => {
        // When a new browser is spawned for a thread, set up CDP connection
        await this.setupThreadConnection(connection, threadId);
      },
    });
  }

  /**
   * Get the browser state for the current thread.
   */
  private getThreadState(threadId?: string): ThreadBrowserState | null {
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const scope = this.threadManager.getScope();

    if (scope === 'shared') {
      return this.sharedState;
    }

    return this.threadStates.get(effectiveThreadId) ?? null;
  }

  /**
   * Get or create the browser state for the current thread.
   */
  private getOrCreateThreadState(threadId?: string): ThreadBrowserState {
    const effectiveThreadId = threadId ?? this.getCurrentThread();
    const scope = this.threadManager.getScope();

    if (scope === 'shared') {
      if (!this.sharedState) {
        this.sharedState = this.createEmptyThreadState();
      }
      return this.sharedState;
    }

    let state = this.threadStates.get(effectiveThreadId);
    if (!state) {
      state = this.createEmptyThreadState();
      this.threadStates.set(effectiveThreadId, state);
    }
    return state;
  }

  /**
   * Create an empty thread state object.
   */
  private createEmptyThreadState(): ThreadBrowserState {
    return {
      cdpClient: null,
      cdpUrl: null,
      processHandle: null,
      screencastStream: null,
      pageTargets: new Map(),
      activeTargetId: null,
      tabChangeDebounceTimer: null,
      targetInfoDebounceTimer: null,
      lastUrl: undefined,
    };
  }

  /**
   * Clean up a thread's browser state.
   * Closes CDP connection, stops screencast, and kills browser process if spawned.
   */
  async destroyThreadState(threadId: string): Promise<void> {
    const state = this.threadStates.get(threadId);
    if (!state) return;

    this.logger.debug?.(`[BrowserViewer] Destroying state for thread ${threadId}`);

    // Clear debounce timers
    if (state.tabChangeDebounceTimer) {
      clearTimeout(state.tabChangeDebounceTimer);
      state.tabChangeDebounceTimer = null;
    }
    if (state.targetInfoDebounceTimer) {
      clearTimeout(state.targetInfoDebounceTimer);
      state.targetInfoDebounceTimer = null;
    }

    // Stop screencast
    if (state.screencastStream) {
      await state.screencastStream.stop();
      state.screencastStream = null;
    }

    // Disconnect CDP
    if (state.cdpClient) {
      await state.cdpClient.detach();
      state.cdpClient = null;
    }

    // Kill browser process if we spawned it
    if (state.processHandle) {
      try {
        await state.processHandle.kill();
      } catch {
        // Process may have already exited
      }
      state.processHandle = null;
    }

    // Clear page targets
    state.pageTargets.clear();
    state.activeTargetId = null;

    // Remove from thread states
    this.threadStates.delete(threadId);
  }

  /**
   * Set up CDP connection for a thread after browser spawn.
   */
  private async setupThreadConnection(connection: ThreadCdpConnection, threadId: string): Promise<void> {
    const state = this.getOrCreateThreadState(threadId);
    state.cdpUrl = connection.cdpUrl;
    state.processHandle = connection.processHandle ?? null;

    // Connect CDP client for this thread
    await this.connectToThread(threadId);

    // Notify listeners that browser is ready
    this.notifyBrowserReady();
  }

  /**
   * Connect to CDP for a specific thread.
   */
  private async connectToThread(threadId: string): Promise<void> {
    const state = this.getOrCreateThreadState(threadId);
    if (!state.cdpUrl) {
      throw new Error(`No CDP URL for thread ${threadId}`);
    }

    state.cdpClient = new CdpClient();
    await state.cdpClient.connect(state.cdpUrl);

    // Enable target discovery
    await state.cdpClient.send('Target.setDiscoverTargets', { discover: true });

    // Get existing targets
    const targetsResult = (await state.cdpClient.send('Target.getTargets')) as {
      targetInfos: CdpTargetInfo[];
    };

    for (const targetInfo of targetsResult.targetInfos || []) {
      if (targetInfo.type === 'page' && !state.pageTargets.has(targetInfo.targetId)) {
        state.pageTargets.set(targetInfo.targetId, {
          targetId: targetInfo.targetId,
          url: targetInfo.url,
          title: targetInfo.title,
          type: targetInfo.type,
        });
      }
    }

    // Select initial active target
    if (!state.activeTargetId && state.pageTargets.size > 0) {
      const regularPage = [...state.pageTargets.values()].find(t => !t.url.startsWith('chrome://'));
      const firstPage = regularPage || [...state.pageTargets.values()][0];
      if (firstPage) {
        state.activeTargetId = firstPage.targetId;
        await this.attachToTargetInState(state, firstPage.targetId);
      }
    }

    // Set up event handlers
    this.setupTargetEventHandlersForState(state, threadId);

    this.logger.debug?.(
      `[BrowserViewer] Connected thread ${threadId} to CDP: ${state.cdpUrl}, tracking ${state.pageTargets.size} pages`,
    );
  }

  /**
   * Discover CDP URL from a spawned process.
   * Used by thread manager when spawning browsers.
   */
  private async discoverCdpFromProcess(processHandle: ProcessHandle): Promise<string | null> {
    // Wait for browser to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Try to find CDP URL in process stdout
    const output = processHandle.stdout;
    if (output) {
      // Look for CDP URL in process output
      const match = output.match(/ws:\/\/[^\s]+/);
      if (match) {
        return this.pageToBrowserCdpUrl(match[0]);
      }
    }

    // Fallback: try to discover from running processes
    return this.discoverBrowserCdpUrl();
  }

  /**
   * Attach to a target in a specific thread state.
   */
  private async attachToTargetInState(state: ThreadBrowserState, targetId: string): Promise<void> {
    if (!state.cdpClient?.isConnected) return;

    try {
      const result = (await state.cdpClient.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      })) as { sessionId: string };

      const target = state.pageTargets.get(targetId);
      if (target) {
        target.sessionId = result.sessionId;
      }

      // Enable Page domain on the target for navigation events
      await state.cdpClient.send('Page.enable', { sessionId: result.sessionId });
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Failed to attach to target ${targetId}:`, error);
    }
  }

  /**
   * Set up CDP target event handlers for a specific thread state.
   */
  private setupTargetEventHandlersForState(state: ThreadBrowserState, threadId: string): void {
    if (!state.cdpClient) return;

    state.cdpClient.on('Target.targetCreated', (params: { targetInfo: CdpTargetInfo }) => {
      this.onTargetCreatedForState(state, params.targetInfo, threadId);
    });

    state.cdpClient.on('Target.targetDestroyed', (params: { targetId: string }) => {
      this.onTargetDestroyedForState(state, params.targetId, threadId);
    });

    state.cdpClient.on('Target.targetInfoChanged', (params: { targetInfo: CdpTargetInfo }) => {
      this.onTargetInfoChangedForState(state, params.targetInfo, threadId);
    });

    state.cdpClient.on(
      'Target.attachedToTarget',
      (params: { sessionId: string; targetInfo: CdpTargetInfo; waitingForDebugger: boolean }) => {
        this.onAttachedToTargetForState(state, params.sessionId, params.targetInfo);
      },
    );

    // Handle browser close
    state.cdpClient.on('close', () => {
      this.handleBrowserDisconnected();
    });
  }

  /**
   * Handle target created event for a specific state.
   */
  private onTargetCreatedForState(state: ThreadBrowserState, targetInfo: CdpTargetInfo, _threadId: string): void {
    if (targetInfo.type !== 'page') return;

    state.pageTargets.set(targetInfo.targetId, {
      targetId: targetInfo.targetId,
      url: targetInfo.url,
      title: targetInfo.title,
      type: targetInfo.type,
    });

    // Debounce to let page initialize
    if (state.tabChangeDebounceTimer) {
      clearTimeout(state.tabChangeDebounceTimer);
    }
    state.tabChangeDebounceTimer = setTimeout(async () => {
      state.tabChangeDebounceTimer = null;

      // Attach and set as active
      await this.attachToTargetInState(state, targetInfo.targetId);
      state.activeTargetId = targetInfo.targetId;

      // Reconnect screencast to new tab
      this.reconnectScreencastForState(state, 'new tab created');
    }, 200);
  }

  /**
   * Handle target destroyed event for a specific state.
   */
  private onTargetDestroyedForState(state: ThreadBrowserState, targetId: string, _threadId: string): void {
    const target = state.pageTargets.get(targetId);
    if (!target) return;

    state.pageTargets.delete(targetId);

    // If the active target was destroyed, switch to another
    if (state.activeTargetId === targetId) {
      state.activeTargetId = null;

      const remainingTargets = [...state.pageTargets.values()];
      if (remainingTargets.length > 0) {
        const newActive = remainingTargets.find(t => !t.url.startsWith('chrome://')) || remainingTargets[0];
        if (newActive) {
          state.activeTargetId = newActive.targetId;
        }
      }

      if (state.tabChangeDebounceTimer) {
        clearTimeout(state.tabChangeDebounceTimer);
      }
      state.tabChangeDebounceTimer = setTimeout(() => {
        state.tabChangeDebounceTimer = null;
        this.reconnectScreencastForState(state, 'tab closed');
      }, 100);
    }
  }

  /**
   * Handle target info changed event for a specific state.
   */
  private onTargetInfoChangedForState(state: ThreadBrowserState, targetInfo: CdpTargetInfo, _threadId: string): void {
    if (targetInfo.type !== 'page') return;

    const existing = state.pageTargets.get(targetInfo.targetId);
    if (existing) {
      existing.url = targetInfo.url;
      existing.title = targetInfo.title;

      // Emit URL update if this is the active target
      if (state.activeTargetId === targetInfo.targetId && state.screencastStream) {
        state.screencastStream.emitUrl(targetInfo.url);
      }
    } else {
      // New page we weren't tracking (manual tab opened and navigated)
      if (targetInfo.url.startsWith('http://') || targetInfo.url.startsWith('https://')) {
        if (state.targetInfoDebounceTimer) {
          clearTimeout(state.targetInfoDebounceTimer);
        }
        state.targetInfoDebounceTimer = setTimeout(async () => {
          state.targetInfoDebounceTimer = null;

          // Add to tracking
          state.pageTargets.set(targetInfo.targetId, {
            targetId: targetInfo.targetId,
            url: targetInfo.url,
            title: targetInfo.title,
            type: targetInfo.type,
          });

          // Attach and make active
          await this.attachToTargetInState(state, targetInfo.targetId);
          state.activeTargetId = targetInfo.targetId;
          this.reconnectScreencastForState(state, 'manual tab navigated');
        }, 300);
      }
    }
  }

  /**
   * Handle attached to target event for a specific state.
   */
  private onAttachedToTargetForState(state: ThreadBrowserState, sessionId: string, targetInfo: CdpTargetInfo): void {
    const target = state.pageTargets.get(targetInfo.targetId);
    if (target) {
      target.sessionId = sessionId;
    }
  }

  /**
   * Reconnect screencast for a specific state.
   */
  private reconnectScreencastForState(state: ThreadBrowserState, reason: string): void {
    const stream = state.screencastStream;
    if (!stream) return;

    this.logger.debug?.(`[BrowserViewer] Reconnecting screencast: ${reason}`);
    void stream.reconnect();

    // Emit current URL
    const activeTarget = state.activeTargetId ? state.pageTargets.get(state.activeTargetId) : null;
    if (activeTarget && activeTarget.url !== 'about:blank') {
      stream.emitUrl(activeTarget.url);
    }
  }

  // ---------------------------------------------------------------------------
  // Thread State Accessors (for backward compatibility with existing methods)
  // ---------------------------------------------------------------------------

  /** Get CDP client for current thread */
  private get cdpClient(): CdpClient | null {
    return this.getThreadState()?.cdpClient ?? null;
  }

  /** Get page targets for current thread */
  private get pageTargets(): Map<string, PageTarget> {
    return this.getThreadState()?.pageTargets ?? new Map();
  }

  /** Get active target ID for current thread */
  private get activeTargetId(): string | null {
    return this.getThreadState()?.activeTargetId ?? null;
  }

  /** Set active target ID for current thread */
  private set activeTargetId(value: string | null) {
    const state = this.getThreadState();
    if (state) {
      state.activeTargetId = value;
    }
  }

  /** Get screencast stream for current thread */
  private get _screencastStream(): ScreencastStream | null {
    return this.getThreadState()?.screencastStream ?? null;
  }

  /** Set screencast stream for current thread */
  private set _screencastStream(value: ScreencastStream | null) {
    const state = this.getThreadState();
    if (state) {
      state.screencastStream = value;
    }
  }

  /** Get last URL for current thread */
  private get lastUrl(): string | undefined {
    return this.getThreadState()?.lastUrl;
  }

  /** Set last URL for current thread */
  private set lastUrl(value: string | undefined) {
    const state = this.getThreadState();
    if (state) {
      state.lastUrl = value;
    }
  }

  /** Get last CDP URL for current thread */
  private get _lastCdpUrl(): string | null {
    return this.getThreadState()?.cdpUrl ?? null;
  }

  /** Set last CDP URL for current thread */
  private set _lastCdpUrl(value: string | null) {
    const state = this.getOrCreateThreadState();
    state.cdpUrl = value;
  }

  /** Get CDP client for current thread (mutable access) */
  private setCdpClient(value: CdpClient | null): void {
    const state = this.getOrCreateThreadState();
    state.cdpClient = value;
  }

  /** Get browser process for current thread */
  private get browserProcess(): ProcessHandle | null {
    return this.getThreadState()?.processHandle ?? null;
  }

  /** Set browser process for current thread */
  private set browserProcess(value: ProcessHandle | null) {
    const state = this.getThreadState();
    if (state) {
      state.processHandle = value;
    }
  }

  /** Get tab change debounce timer for current thread */
  private get tabChangeDebounceTimer(): ReturnType<typeof setTimeout> | null {
    return this.getThreadState()?.tabChangeDebounceTimer ?? null;
  }

  /** Set tab change debounce timer for current thread */
  private set tabChangeDebounceTimer(value: ReturnType<typeof setTimeout> | null) {
    const state = this.getThreadState();
    if (state) {
      state.tabChangeDebounceTimer = value;
    }
  }

  /** Get target info debounce timer for current thread */
  private get targetInfoDebounceTimer(): ReturnType<typeof setTimeout> | null {
    return this.getThreadState()?.targetInfoDebounceTimer ?? null;
  }

  /** Set target info debounce timer for current thread */
  private set targetInfoDebounceTimer(value: ReturnType<typeof setTimeout> | null) {
    const state = this.getThreadState();
    if (state) {
      state.targetInfoDebounceTimer = value;
    }
  }

  // ---------------------------------------------------------------------------
  // MastraBrowser Abstract Method Implementations
  // ---------------------------------------------------------------------------

  /**
   * Launch the browser via CLI and connect to it.
   * Called by ensureReady() when browser needs to be started.
   */
  protected async doLaunch(): Promise<void> {
    // First, try to launch the browser via CLI
    await this.launchBrowserViaCLI();
    // Then connect to it
    await this.connect();

    // Restore previous browser state if available
    const savedState = this.getLastBrowserState();
    if (savedState && savedState.tabs.length > 0) {
      await this.restoreBrowserState(savedState);
    }
  }

  /**
   * Launch the browser using the CLI provider.
   * This runs the CLI's open/launch command.
   *
   * When processManager is available, spawns the browser as a tracked background
   * process, enabling PID-based CDP port discovery and thread isolation.
   */
  private async launchBrowserViaCLI(): Promise<void> {
    const cli = this.viewerConfig.cli;
    if (!cli) {
      // No CLI configured, assume browser is already running
      return;
    }

    if (typeof cli !== 'string') {
      // Custom CLI providers don't have openArgs, so we skip launching
      return;
    }

    // Built-in CLI provider
    const commands = CLI_PROVIDER_COMMANDS[cli];
    if (!commands) {
      throw new Error(`Unknown CLI provider: ${cli}`);
    }

    // Build open args based on headless config
    // Default is headless=true (no visible UI), so we only add headed arg when headless=false
    const openArgs = [...commands.openArgs];
    if (this.viewerConfig.headless === false && commands.headedArg) {
      openArgs.push(commands.headedArg);
    }

    // Try direct command first, fall back to npx
    const useNpx = !commandExists(commands.binary);
    const cmdParts = useNpx ? ['npx', commands.npxPackage, ...openArgs] : [commands.binary, ...openArgs];
    const fullCommand = cmdParts.join(' ');

    // Prefer processManager for spawning (enables PID tracking and thread isolation)
    const processManager = this.viewerConfig.processManager;
    if (processManager) {
      try {
        this.browserProcess = await processManager.spawn(fullCommand);
        this.logger.debug?.(`[BrowserViewer] Spawned browser process with PID: ${this.browserProcess.pid}`);

        // Wait a bit for the browser to start and expose CDP port
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        // Process may exit quickly for daemon-style CLIs - this is expected
      }
      return;
    }

    // Fallback to execCommand (one-shot, no PID tracking)
    const execCommand = this.viewerConfig.execCommand;
    if (!execCommand) {
      console.warn('[BrowserViewer] No processManager or execCommand configured, cannot launch browser via CLI');
      return;
    }

    try {
      await execCommand(fullCommand);
    } catch {
      // Command may "fail" but browser still launches - this is expected for daemon-style CLIs
    }
  }

  /**
   * Close the browser connection and optionally kill the browser process.
   *
   * When the browser was spawned via processManager, we kill the process
   * to clean up properly. Otherwise, we just disconnect (CLI handles lifecycle).
   */
  protected async doClose(): Promise<void> {
    const scope = this.threadManager.getScope();

    if (scope === 'thread') {
      // In thread scope mode, destroy all thread states
      await this.destroyAllThreadStates();
      await this.threadManager.destroyAllSessions();
    } else {
      // In 'shared' mode, disconnect the shared connection
      await this.disconnect();

      // If we spawned the browser via processManager, kill it
      if (this.browserProcess) {
        this.logger.debug?.(`[BrowserViewer] Killing browser process ${this.browserProcess.pid}`);
        await this.browserProcess.kill();
        this.browserProcess = null;
      }
    }
  }

  /**
   * Destroy all thread browser states.
   * Called during close/cleanup.
   */
  private async destroyAllThreadStates(): Promise<void> {
    const threadIds = [...this.threadStates.keys()];
    for (const threadId of threadIds) {
      await this.destroyThreadState(threadId);
    }

    // Also clean up shared state
    if (this.sharedState) {
      if (this.sharedState.screencastStream) {
        await this.sharedState.screencastStream.stop();
      }
      if (this.sharedState.cdpClient) {
        await this.sharedState.cdpClient.detach();
      }
      if (this.sharedState.processHandle) {
        try {
          await this.sharedState.processHandle.kill();
        } catch {
          // Process may have already exited
        }
      }
      this.sharedState = null;
    }
  }

  /**
   * CLI providers don't provide tools - the agent uses execute_command + skills.
   * Returns an empty record.
   */
  getTools(): Record<string, Tool<any, any>> {
    // CLI-based automation uses skills, not SDK tools
    return {};
  }

  /**
   * The CLI provider being used
   */
  get cli(): CLIProvider | undefined {
    return this.viewerConfig.cli;
  }

  /**
   * The last CDP URL that was used to connect
   */
  get lastCdpUrl(): string | null {
    return this._lastCdpUrl;
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Connect to the browser via CDP WebSocket.
   * Gets the CDP URL from the configured CLI provider or direct cdpUrl.
   *
   * Establishes a browser-level connection to receive Target.* events
   * for multi-tab tracking.
   */
  async connect(): Promise<void> {
    if (this.cdpClient?.isConnected) {
      return; // Already connected
    }

    // Get browser-level CDP URL (not page-level)
    const browserCdpUrl = await this.getBrowserCdpUrl();
    this._lastCdpUrl = browserCdpUrl;
    const client = new CdpClient();
    this.setCdpClient(client);

    try {
      await client.connect(browserCdpUrl);

      // Set up Target event handlers for multi-tab tracking BEFORE enabling discovery
      // This ensures we catch all targetCreated events
      this.setupTargetEventHandlers();

      // Enable Target domain for multi-tab tracking
      // This will fire targetCreated events for existing targets
      await client.send('Target.setDiscoverTargets', { discover: true });

      // Also explicitly get current targets to ensure we have them
      const targetsResult = (await client.send('Target.getTargets')) as {
        targetInfos: CdpTargetInfo[];
      };

      this.logger.debug?.(`[BrowserViewer] Got ${targetsResult?.targetInfos?.length || 0} targets from getTargets`);

      // Process any targets we got (in case events were missed)
      const state = this.getOrCreateThreadState();
      for (const targetInfo of targetsResult?.targetInfos || []) {
        if (targetInfo.type === 'page' && !state.pageTargets.has(targetInfo.targetId)) {
          state.pageTargets.set(targetInfo.targetId, {
            targetId: targetInfo.targetId,
            url: targetInfo.url,
            title: targetInfo.title,
            type: targetInfo.type,
          });
        }
      }

      // Pick an active target
      if (!state.activeTargetId && state.pageTargets.size > 0) {
        // Prefer non-chrome:// pages
        const regularPage = [...state.pageTargets.values()].find(t => !t.url.startsWith('chrome://'));
        const firstPage = regularPage || [...state.pageTargets.values()][0];
        if (firstPage) {
          state.activeTargetId = firstPage.targetId;
          this.logger.debug?.(`[BrowserViewer] Selected active target: ${firstPage.targetId} (${firstPage.url})`);
          // Attach to the active target to get session ID and enable page events
          await this.attachToTarget(firstPage.targetId);
        }
      }

      if (!state.activeTargetId) {
        this.logger.debug?.('[BrowserViewer] Warning: No page targets found after connection');
      }

      this.logger.debug?.(
        `[BrowserViewer] Connected to CDP: ${browserCdpUrl}, tracking ${state.pageTargets.size} pages`,
      );
      this.notifyBrowserReady();

      // Handle disconnection
      client.on('close', () => {
        this.handleDisconnect();
      });
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Connection failed: ${error}`);
      this.setCdpClient(null);
      throw error;
    }
  }

  /**
   * Set up CDP Target event handlers for multi-tab tracking.
   */
  private setupTargetEventHandlers(): void {
    if (!this.cdpClient) return;

    // New tab/page created
    this.cdpClient.on('Target.targetCreated', (params: { targetInfo: CdpTargetInfo }) => {
      this.onTargetCreated(params.targetInfo);
    });

    // Tab/page destroyed
    this.cdpClient.on('Target.targetDestroyed', (params: { targetId: string }) => {
      this.onTargetDestroyed(params.targetId);
    });

    // Tab info changed (URL, title, etc.) - used for manual tab tracking
    this.cdpClient.on('Target.targetInfoChanged', (params: { targetInfo: CdpTargetInfo }) => {
      this.onTargetInfoChanged(params.targetInfo);
    });

    // Target attached (gives us session ID)
    this.cdpClient.on(
      'Target.attachedToTarget',
      (params: { sessionId: string; targetInfo: CdpTargetInfo; waitingForDebugger: boolean }) => {
        this.onAttachedToTarget(params.sessionId, params.targetInfo);
      },
    );
  }

  /**
   * Handle new target creation.
   */
  private onTargetCreated(targetInfo: CdpTargetInfo): void {
    // Only track page-type targets
    if (targetInfo.type !== 'page') return;

    this.logger.debug?.(`[BrowserViewer] Target created: ${targetInfo.targetId} (${targetInfo.url})`);

    // Add to our tracking map
    this.pageTargets.set(targetInfo.targetId, {
      targetId: targetInfo.targetId,
      url: targetInfo.url,
      title: targetInfo.title,
      type: targetInfo.type,
    });

    // New tab created - switch to it and reconnect screencast
    // This handles both CLI --new-tab and manual tab creation
    if (this.tabChangeDebounceTimer) {
      clearTimeout(this.tabChangeDebounceTimer);
    }
    this.tabChangeDebounceTimer = setTimeout(async () => {
      this.tabChangeDebounceTimer = null;

      // Attach to the new target to get navigation events
      await this.attachToTarget(targetInfo.targetId);

      // Switch active target to the new tab
      this.activeTargetId = targetInfo.targetId;
      this.logger.debug?.(`[BrowserViewer] Switched to new tab: ${targetInfo.targetId} (${targetInfo.url})`);

      // Reconnect screencast to the new tab
      await this.reconnectScreencast('new tab');
    }, 100);
  }

  /**
   * Handle target destruction.
   */
  private onTargetDestroyed(targetId: string): void {
    const target = this.pageTargets.get(targetId);
    if (!target) return;

    this.logger.debug?.(`[BrowserViewer] Target destroyed: ${targetId}`);

    // Remove from tracking
    this.pageTargets.delete(targetId);

    // If the active target was destroyed, switch to another
    if (this.activeTargetId === targetId) {
      this.activeTargetId = null;

      // Pick a new active target
      const remainingTargets = [...this.pageTargets.values()];
      if (remainingTargets.length > 0) {
        const regularPage = remainingTargets.find(t => !t.url.startsWith('chrome://'));
        const newActive = regularPage || remainingTargets[0];
        if (newActive) {
          this.activeTargetId = newActive.targetId;
        }
      }

      // Reconnect screencast to new active target
      if (this.tabChangeDebounceTimer) {
        clearTimeout(this.tabChangeDebounceTimer);
      }
      this.tabChangeDebounceTimer = setTimeout(() => {
        this.tabChangeDebounceTimer = null;
        void this.reconnectScreencast('tab closed');
      }, 100);
    }
  }

  /**
   * Handle target info changes (URL, title updates).
   * This is key for detecting when manual tabs navigate to trackable URLs.
   */
  private onTargetInfoChanged(targetInfo: CdpTargetInfo): void {
    // Only track page-type targets
    if (targetInfo.type !== 'page') return;

    const existing = this.pageTargets.get(targetInfo.targetId);

    if (existing) {
      // Update existing target info
      existing.url = targetInfo.url;
      existing.title = targetInfo.title;

      // If this is the active target, emit URL
      if (this.activeTargetId === targetInfo.targetId && this._screencastStream) {
        this._screencastStream.emitUrl(targetInfo.url);
      }
    } else {
      // This is a target we weren't tracking (e.g., manual new tab that navigated)
      // If it's an http(s) URL, start tracking it
      if (targetInfo.url.startsWith('http://') || targetInfo.url.startsWith('https://')) {
        // Debounce to avoid rapid updates
        if (this.targetInfoDebounceTimer) {
          clearTimeout(this.targetInfoDebounceTimer);
        }
        this.targetInfoDebounceTimer = setTimeout(() => {
          this.targetInfoDebounceTimer = null;

          this.logger.debug?.(`[BrowserViewer] Tracking new manual tab: ${targetInfo.url}`);

          // Add to tracking
          this.pageTargets.set(targetInfo.targetId, {
            targetId: targetInfo.targetId,
            url: targetInfo.url,
            title: targetInfo.title,
            type: targetInfo.type,
          });

          // Attach to get navigation events and make it active
          void this.attachToTarget(targetInfo.targetId).then(() => {
            this.activeTargetId = targetInfo.targetId;
            void this.reconnectScreencast('manual tab tracked');
          });
        }, 300);
      }
    }
  }

  /**
   * Handle target attachment (gives us session ID for page-level events).
   */
  private onAttachedToTarget(sessionId: string, targetInfo: CdpTargetInfo): void {
    const target = this.pageTargets.get(targetInfo.targetId);
    if (target) {
      target.sessionId = sessionId;
      this.logger.debug?.(`[BrowserViewer] Attached to target: ${targetInfo.targetId}, sessionId: ${sessionId}`);
    }
  }

  /**
   * Attach to a target to get its session ID and enable page events.
   */
  private async attachToTarget(targetId: string): Promise<void> {
    if (!this.cdpClient?.isConnected) return;

    try {
      this.logger.debug?.(`[BrowserViewer] Attaching to target: ${targetId}`);
      const result = (await this.cdpClient.send('Target.attachToTarget', {
        targetId,
        flatten: true, // Use flattened protocol for easier session messaging
      })) as { sessionId: string };

      this.logger.debug?.(`[BrowserViewer] Attached with sessionId: ${result.sessionId}`);

      const target = this.pageTargets.get(targetId);
      if (target) {
        target.sessionId = result.sessionId;

        // Enable Page domain on this target's session for navigation events
        await this.sendToTarget(targetId, 'Page.enable');
        // Note: Input domain does not require enable - commands work immediately
        this.logger.debug?.(`[BrowserViewer] Page.enable sent for target: ${targetId}`);
      } else {
        this.logger.debug?.(`[BrowserViewer] Target ${targetId} not found in pageTargets`);
      }
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Failed to attach to target ${targetId}: ${error}`);
    }
  }

  /**
   * Send a CDP command to a specific target's session.
   * With flatten: true, we include sessionId in every command to route it correctly.
   */
  private async sendToTarget(targetId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected');
    }

    const target = this.pageTargets.get(targetId);
    if (!target?.sessionId) {
      throw new Error(`Target ${targetId} not attached (no sessionId)`);
    }

    // With flattened protocol, include sessionId in params - CdpClient.send extracts it
    try {
      return await this.cdpClient.send(method, {
        ...params,
        sessionId: target.sessionId,
      });
    } catch (error) {
      // Add context to CDP errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`CDP command ${method} failed for target ${targetId}: ${errorMessage}`);
    }
  }

  /**
   * Get the active page target.
   */
  private getActiveTarget(): PageTarget | null {
    if (!this.activeTargetId) return null;
    return this.pageTargets.get(this.activeTargetId) || null;
  }

  /**
   * Get the browser-level CDP WebSocket URL.
   * This connects to the browser process, not a specific page, enabling Target.* events.
   */
  private async getBrowserCdpUrl(): Promise<string> {
    // Direct CDP URL takes precedence
    if (this.viewerConfig.cdpUrl) {
      const cdpUrl =
        typeof this.viewerConfig.cdpUrl === 'function' ? await this.viewerConfig.cdpUrl() : this.viewerConfig.cdpUrl;

      // If it's a page URL, convert to browser URL
      if (cdpUrl.includes('/devtools/page/')) {
        return this.pageToBrowserCdpUrl(cdpUrl);
      }
      return cdpUrl;
    }

    // Get CDP URL from CLI provider (returns browser-level URL)
    if (this.viewerConfig.cli) {
      return await this.getBrowserCdpUrlFromCLI();
    }

    throw new Error('No CDP URL source configured. Provide either `cdpUrl` or `cli` in config.');
  }

  /**
   * Convert a page-level CDP URL to browser-level CDP URL.
   * Example: ws://127.0.0.1:9222/devtools/page/ABC -> ws://127.0.0.1:9222/devtools/browser
   */
  private pageToBrowserCdpUrl(pageUrl: string): string {
    const match = pageUrl.match(/^(wss?:\/\/[^/]+)/);
    if (!match) return pageUrl;

    const base = match[1];
    // Query /json/version to get the browser WebSocket URL
    // For now, construct it directly (most browsers use this format)
    return `${base}/devtools/browser`;
  }

  /**
   * Get the browser-level CDP URL from the CLI provider.
   */
  private async getBrowserCdpUrlFromCLI(): Promise<string> {
    const cli = this.viewerConfig.cli;
    if (!cli) {
      throw new Error('No CLI provider configured');
    }

    if (typeof cli === 'string') {
      // Built-in provider
      const providerConfig = CLI_PROVIDER_COMMANDS[cli];
      if (!providerConfig) {
        throw new Error(`Unknown CLI provider: ${cli}`);
      }

      // If provider has a direct command to get CDP URL, use it
      if (providerConfig.getCdpUrlArgs.length > 0) {
        const binaryExists = commandExists(providerConfig.binary);
        const cmdPrefix = binaryExists ? providerConfig.binary : `npx ${providerConfig.npxPackage}`;
        const command = `${cmdPrefix} ${providerConfig.getCdpUrlArgs.join(' ')}`;

        try {
          const result = await this.execCommand(command);
          const cdpUrl = result.stdout.trim();

          if (cdpUrl && (cdpUrl.startsWith('ws://') || cdpUrl.startsWith('wss://'))) {
            // Convert page URL to browser URL if needed
            if (cdpUrl.includes('/devtools/page/')) {
              return this.pageToBrowserCdpUrl(cdpUrl);
            }
            return cdpUrl;
          }
        } catch {
          // Command failed - fall back to process discovery
        }
      }

      // Fallback: discover CDP port from running Chrome processes
      const browserUrl = await this.discoverBrowserCdpUrl();
      if (browserUrl) {
        return browserUrl;
      }

      throw new Error(`Could not find CDP URL for ${cli}. Is the browser running?`);
    } else {
      // Custom provider - use the provided command
      const command = cli.getCdpUrlCommand;
      try {
        const result = await this.execCommand(command);
        const cdpUrl = result.stdout.trim();

        if (!cdpUrl) {
          throw new Error(`CLI returned empty CDP URL. Is the browser running?`);
        }

        if (!cdpUrl.startsWith('ws://') && !cdpUrl.startsWith('wss://')) {
          throw new Error(`Invalid CDP URL from CLI: ${cdpUrl}`);
        }

        // Convert page URL to browser URL if needed
        if (cdpUrl.includes('/devtools/page/')) {
          return this.pageToBrowserCdpUrl(cdpUrl);
        }
        return cdpUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get CDP URL from CLI: ${message}`);
      }
    }
  }

  /**
   * Discover browser-level CDP URL from running Chrome processes.
   */
  private async discoverBrowserCdpUrl(): Promise<string | null> {
    try {
      let cmd: string;

      if (this.browserProcess && process.platform !== 'win32') {
        const pid = this.browserProcess.pid;
        cmd = `pgrep -P ${pid} | xargs -I{} ps -p {} -o command= 2>/dev/null | grep -E 'remote-debugging-port'`;
      } else {
        cmd =
          process.platform === 'win32'
            ? "wmic process where \"name like '%chrome%' or name like '%chromium%'\" get commandline 2>nul"
            : "ps aux | grep -E 'chrome|chromium' | grep 'remote-debugging-port' | grep -v grep";
      }

      const result = await this.execCommand(cmd);
      const output = result.stdout;

      const portMatches = output.matchAll(/--remote-debugging-port=(\d+)/g);
      const ports = [...new Set([...portMatches].map(m => m[1]).filter(p => p !== '0'))];

      for (const port of ports.reverse()) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
            signal: AbortSignal.timeout(1000),
          });
          if (response.ok) {
            const data = (await response.json()) as { webSocketDebuggerUrl?: string };
            if (data.webSocketDebuggerUrl) {
              // This is already the browser-level URL
              return data.webSocketDebuggerUrl;
            }
          }
        } catch {
          // Port not accessible, try next
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Execute a shell command.
   */
  private async execCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    // Use custom executor if provided (e.g., for sandbox execution)
    if (this.viewerConfig.execCommand) {
      return await this.viewerConfig.execCommand(command);
    }

    // Default: use child_process
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    return await execAsync(command);
  }

  /**
   * Check if the CLI provider is installed.
   */
  async checkCLI(): Promise<boolean> {
    const cli = this.viewerConfig.cli;
    if (!cli) {
      return false;
    }

    if (typeof cli === 'string') {
      const providerConfig = CLI_PROVIDER_COMMANDS[cli];
      if (!providerConfig) {
        return false;
      }

      // Check if binary exists directly or via npx
      if (commandExists(providerConfig.binary)) {
        return true;
      }

      // Try npx fallback
      try {
        const checkCmd = `npx ${providerConfig.npxPackage} ${providerConfig.checkArgs.join(' ')}`;
        await this.execCommand(checkCmd);
        return true;
      } catch {
        return false;
      }
    } else {
      // Custom provider
      if (!cli.checkCommand) {
        return true; // No check command, assume installed
      }

      try {
        await this.execCommand(cli.checkCommand);
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get the install command for the CLI provider.
   */
  getInstallCommand(): string | undefined {
    const cli = this.viewerConfig.cli;
    if (!cli) {
      return undefined;
    }

    if (typeof cli === 'string') {
      return CLI_PROVIDER_COMMANDS[cli]?.install;
    } else {
      return cli.installCommand;
    }
  }

  /**
   * Disconnect from the browser.
   */
  async disconnect(): Promise<void> {
    this.stopPollingForBrowser();

    if (this._screencastStream) {
      await this._screencastStream.stop();
      this._screencastStream = null;
    }

    if (this.cdpClient) {
      await this.cdpClient.detach();
      this.setCdpClient(null);
    }
  }

  private handleDisconnect(): void {
    this.setCdpClient(null);
    this.notifyBrowserClosed();
  }

  // ---------------------------------------------------------------------------
  // Browser Ready/Closed Callbacks (MastraBrowser API compatibility)
  // ---------------------------------------------------------------------------

  /**
   * Override to invoke callback immediately if browser is already connected,
   * and start polling for browser availability if not.
   */
  override onBrowserReady(callback: () => void): () => void {
    if (this.isBrowserRunning()) {
      // Browser already ready - invoke immediately
      callback();
      return () => {};
    }

    // Start polling for browser availability (CLI launches browser externally)
    this.startPollingForBrowser();

    return super.onBrowserReady(callback);
  }

  /**
   * Start polling for browser availability.
   * When the CLI browser becomes available, connects and notifies listeners.
   */
  private startPollingForBrowser(): void {
    if (this._isPollingForBrowser) {
      return; // Already polling
    }

    this._isPollingForBrowser = true;
    this.pollForBrowser();
  }

  /**
   * Stop polling for browser availability.
   */
  private stopPollingForBrowser(): void {
    this._isPollingForBrowser = false;
    if (this.browserPollTimer) {
      clearTimeout(this.browserPollTimer);
      this.browserPollTimer = null;
    }
  }

  /**
   * Poll for browser availability and connect when ready.
   */
  private pollForBrowser(): void {
    if (!this._isPollingForBrowser) {
      return;
    }

    // Try to connect to the browser
    this.connect()
      .then(() => {
        // Successfully connected - stop polling
        this.stopPollingForBrowser();
        // notifyBrowserReady() is called in connect()
      })
      .catch(() => {
        // Browser not ready yet - schedule next poll
        if (this._isPollingForBrowser) {
          this.browserPollTimer = setTimeout(() => this.pollForBrowser(), 1000);
        }
      });
  }

  // ---------------------------------------------------------------------------
  // CdpSessionProvider Implementation
  // ---------------------------------------------------------------------------

  /**
   * Get a CDP session for the active page target.
   *
   * Returns a wrapper that routes commands to the active target's session.
   * With browser-level CDP connection, page-level commands (like Page.startScreencast)
   * need to be sent with the target's sessionId.
   */
  async getCdpSession(): Promise<CdpSessionLike> {
    if (!this.cdpClient) {
      throw new Error('Not connected to browser');
    }

    const activeTarget = this.getActiveTarget();
    if (!activeTarget?.sessionId) {
      // If no active target with session, try to attach to one
      if (this.activeTargetId) {
        await this.attachToTarget(this.activeTargetId);
        const refreshedTarget = this.getActiveTarget();
        if (!refreshedTarget?.sessionId) {
          throw new Error('No page available for screencast');
        }
      } else {
        throw new Error('No page available for screencast');
      }
    }

    const sessionId = this.getActiveTarget()?.sessionId;
    if (!sessionId) {
      throw new Error('No page session available');
    }

    // Track event listeners per session for cleanup
    const eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();
    // Map original handlers to wrapped handlers for proper cleanup
    const handlerMap = new Map<(...args: unknown[]) => void, (params: Record<string, unknown>) => void>();

    // Create a wrapper that routes commands to the target session
    const sessionWrapper: CdpSessionLike = {
      send: async (method: string, params?: Record<string, unknown>): Promise<unknown> => {
        if (!this.cdpClient?.isConnected) {
          throw new Error('Not connected to browser');
        }
        // With flattened protocol, include sessionId to route to target
        return this.cdpClient.send(method, { ...params, sessionId });
      },

      on: (event: string, handler: (...args: unknown[]) => void): void => {
        if (!this.cdpClient) return;

        // Track the listener
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(handler);

        // With flattened protocol, events come with sessionId
        // We filter to only pass events from our target session
        const wrappedHandler = (params: Record<string, unknown>) => {
          // Events from flattened protocol include sessionId
          if (params.sessionId === sessionId || !params.sessionId) {
            handler(params);
          }
        };

        // Store the wrapped handler for cleanup using a WeakMap-style approach
        handlerMap.set(handler, wrappedHandler);
        this.cdpClient.on(event, wrappedHandler);
      },

      off: (event: string, handler: (...args: unknown[]) => void): void => {
        if (!this.cdpClient) return;

        const wrappedHandler = handlerMap.get(handler);
        if (wrappedHandler && this.cdpClient.off) {
          this.cdpClient.off(event, wrappedHandler);
        }
        handlerMap.delete(handler);

        // Remove from tracking
        eventListeners.get(event)?.delete(handler);
      },
    };

    return sessionWrapper;
  }

  isBrowserRunning(): boolean {
    return this.cdpClient?.isConnected ?? false;
  }

  /**
   * Check if currently connected to a browser.
   */
  get isConnected(): boolean {
    return this.cdpClient?.isConnected ?? false;
  }

  // ---------------------------------------------------------------------------
  // Screencast
  // ---------------------------------------------------------------------------

  /**
   * Start screencast streaming.
   * Returns a ScreencastStream that emits 'frame' events.
   */
  async startScreencast(options?: ScreencastOptions): Promise<ScreencastStream> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }

    if (this._screencastStream) {
      await this._screencastStream.stop();
    }

    this._screencastStream = new ScreencastStream(this, options ?? this.config.screencast);

    // Listen for navigation events (URL changes) via CDP
    // With flattened protocol, events include sessionId to identify the source target
    const onFrameNavigated = (params: { frame: { url: string; parentId?: string }; sessionId?: string }) => {
      // Only emit URL for main frame navigations (no parentId)
      if (params.frame.parentId || !params.frame.url) {
        return;
      }

      // With flattened protocol, filter by active target's session
      const activeTarget = this.getActiveTarget();
      if (params.sessionId && activeTarget?.sessionId && params.sessionId !== activeTarget.sessionId) {
        // Event is from a different tab, ignore
        return;
      }

      // Update URL tracking
      this.lastUrl = params.frame.url;

      // Update the active target's URL in our tracking
      if (activeTarget) {
        activeTarget.url = params.frame.url;
      }

      // Emit to UI
      if (params.frame.url !== 'about:blank') {
        this._screencastStream?.emitUrl(params.frame.url);
      }
    };
    this.cdpClient.on('Page.frameNavigated', onFrameNavigated);

    // Clean up listener when stream stops
    this._screencastStream.once('stop', () => {
      this.cdpClient?.off?.('Page.frameNavigated', onFrameNavigated);
    });

    await this._screencastStream.start();

    // Fetch initial URL
    await this.getCurrentUrl();

    return this._screencastStream;
  }

  /**
   * Start screencast only if browser is already connected.
   * Does NOT attempt to connect.
   * (MastraBrowser API compatibility)
   */
  async startScreencastIfBrowserActive(options?: ScreencastOptions): Promise<ScreencastStream | null> {
    if (!this.isBrowserRunning()) {
      return null;
    }
    return this.startScreencast(options);
  }

  /**
   * Reconnect the active screencast to the current active target.
   * Called when tabs change to ensure we're streaming the right page.
   */
  private async reconnectScreencast(reason: string): Promise<void> {
    const stream = this._screencastStream;
    if (!stream || !stream.isActive()) {
      return;
    }

    if (!this.isBrowserRunning()) {
      this.logger.debug?.(`[BrowserViewer] Skipping screencast reconnect - browser not running`);
      return;
    }

    this.logger.debug?.(`[BrowserViewer] Reconnecting screencast: ${reason}`);

    try {
      await stream.reconnect();

      // Emit the URL of the new active target
      const activeTarget = this.getActiveTarget();
      if (activeTarget && activeTarget.url && activeTarget.url !== 'about:blank') {
        stream.emitUrl(activeTarget.url);
      }
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Failed to reconnect screencast: ${error}`);
    }
  }

  /**
   * Restore browser state (multiple tabs) after reconnection.
   * Creates new tabs via CDP Target.createTarget and navigates to saved URLs.
   */
  async restoreBrowserState(state: BrowserState): Promise<void> {
    if (!this.cdpClient?.isConnected) {
      this.logger.debug?.('[BrowserViewer] Cannot restore state - not connected');
      return;
    }

    if (!state.tabs || state.tabs.length === 0) {
      return;
    }

    try {
      this.logger.debug?.(`[BrowserViewer] Restoring ${state.tabs.length} tabs, active=${state.activeTabIndex}`);

      // Get the first tab target (should already exist after connect)
      const existingTargets = [...this.pageTargets.values()];
      const firstTarget = existingTargets[0];

      // Navigate first tab to first URL
      const firstTab = state.tabs[0];
      if (firstTab?.url && firstTarget?.sessionId) {
        await this.navigateTarget(firstTarget.targetId, firstTab.url);
      }

      // Create additional tabs
      for (let i = 1; i < state.tabs.length; i++) {
        const tab = state.tabs[i];
        if (tab?.url) {
          await this.createNewTab(tab.url);
        }
      }

      // Wait for targets to be discovered
      await new Promise(resolve => setTimeout(resolve, 200));

      // Switch to the active tab
      const allTargets = [...this.pageTargets.keys()];
      if (state.activeTabIndex >= 0 && state.activeTabIndex < allTargets.length) {
        const targetId = allTargets[state.activeTabIndex];
        if (targetId) {
          await this.switchToTarget(targetId);
        }
      }
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Failed to restore browser state: ${error}`);
    }
  }

  /**
   * Navigate a specific target to a URL.
   */
  private async navigateTarget(targetId: string, url: string): Promise<void> {
    if (!this.cdpClient?.isConnected) return;

    const target = this.pageTargets.get(targetId);
    if (!target?.sessionId) {
      // Try to attach first
      await this.attachToTarget(targetId);
    }

    try {
      await this.cdpClient.send('Target.sendMessageToTarget', {
        targetId,
        message: JSON.stringify({
          id: Date.now(),
          method: 'Page.navigate',
          params: { url },
        }),
      });
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Failed to navigate target ${targetId}: ${error}`);
    }
  }

  /**
   * Create a new tab and optionally navigate to a URL.
   */
  private async createNewTab(url?: string): Promise<string | null> {
    if (!this.cdpClient?.isConnected) return null;

    try {
      const result = (await this.cdpClient.send('Target.createTarget', {
        url: url || 'about:blank',
      })) as { targetId: string };

      return result.targetId;
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Failed to create new tab: ${error}`);
      return null;
    }
  }

  /**
   * Switch the active target and reconnect screencast.
   */
  private async switchToTarget(targetId: string): Promise<void> {
    if (!this.pageTargets.has(targetId)) return;

    // Activate the target in the browser UI
    try {
      await this.cdpClient?.send('Target.activateTarget', { targetId });
    } catch {
      // Some browsers may not support this - continue anyway
    }

    this.activeTargetId = targetId;
    await this.reconnectScreencast('tab switch');
  }

  // ---------------------------------------------------------------------------
  // URL and Title Access
  // ---------------------------------------------------------------------------

  /**
   * Get the current URL of the browser page.
   * Queries the browser via CDP if connected, otherwise returns cached value.
   * @param _threadId - Ignored for BrowserViewer (no thread isolation)
   */
  override async getCurrentUrl(_threadId?: string): Promise<string | null> {
    if (!this.cdpClient?.isConnected) {
      return this.lastUrl ?? null;
    }

    try {
      const result = (await this.cdpClient.send('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true,
      })) as { result?: { value?: string } };

      const url = result?.result?.value;
      if (url) {
        this.lastUrl = url;
      }
      return url ?? null;
    } catch {
      return this.lastUrl ?? null;
    }
  }

  /**
   * Get the current page title.
   */
  async getTitle(): Promise<string | null> {
    if (!this.cdpClient?.isConnected) {
      return null;
    }

    try {
      const result = (await this.cdpClient.send('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true,
      })) as { result?: { value?: string } };

      return result?.result?.value ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get the last known URL (for context injection when disconnected).
   * Returns the active target's URL or the cached lastUrl.
   */
  getLastUrl(): string | undefined {
    const activeTarget = this.getActiveTarget();
    return activeTarget?.url || this.lastUrl;
  }

  /**
   * Get the current browser state (all tabs and active tab index).
   * Uses tracked page targets for multi-tab support.
   */
  override async getBrowserState(_threadId?: string): Promise<BrowserState | null> {
    if (!this.isBrowserRunning() || this.pageTargets.size === 0) {
      return null;
    }

    const tabs = await this.getTabState();
    const activeTabIndex = await this.getActiveTabIndex();

    return {
      tabs,
      activeTabIndex,
    };
  }

  /**
   * Get state of all tracked tabs.
   */
  override async getTabState(_threadId?: string): Promise<BrowserTabState[]> {
    return [...this.pageTargets.values()].map(target => ({
      url: target.url,
      title: target.title,
    }));
  }

  /**
   * Get the index of the currently active tab.
   */
  override async getActiveTabIndex(_threadId?: string): Promise<number> {
    if (!this.activeTargetId) return 0;

    const targets = [...this.pageTargets.keys()];
    const index = targets.indexOf(this.activeTargetId);
    return index >= 0 ? index : 0;
  }

  /**
   * Get the active page for a thread.
   * Returns an object with url() method for compatibility with the base class interface.
   */
  protected override async getActivePage(_threadId?: string): Promise<{ url(): string } | null> {
    if (!this.activeTargetId) return null;
    const target = this.pageTargets.get(this.activeTargetId);
    if (!target) return null;
    return {
      url: () => target.url,
    };
  }

  /**
   * Get the current browser state for a thread.
   */
  protected override getBrowserStateForThread(_threadId?: string): BrowserState | null {
    if (!this.isBrowserRunning() || this.pageTargets.size === 0) {
      return null;
    }

    const tabs = [...this.pageTargets.values()].map(target => ({
      url: target.url,
      title: target.title,
    }));

    const activeTabIndex = this.activeTargetId
      ? Math.max(0, [...this.pageTargets.keys()].indexOf(this.activeTargetId))
      : 0;

    return {
      tabs,
      activeTabIndex,
    };
  }

  /**
   * Get the last browser state for restoration.
   * Returns multi-tab state from tracked targets, or falls back to lastUrl.
   */
  override getLastBrowserState(): BrowserState | undefined {
    // If we have tracked targets, use them
    if (this.pageTargets.size > 0) {
      const tabs = [...this.pageTargets.values()].map(t => ({
        url: t.url,
        title: t.title,
      }));
      const activeIndex = this.activeTargetId ? [...this.pageTargets.keys()].indexOf(this.activeTargetId) : 0;

      return {
        tabs,
        activeTabIndex: activeIndex >= 0 ? activeIndex : 0,
      };
    }

    // Fallback to lastUrl for single-tab restoration
    if (this.lastUrl) {
      return {
        tabs: [{ url: this.lastUrl }],
        activeTabIndex: 0,
      };
    }

    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Input Injection
  // ---------------------------------------------------------------------------

  /**
   * Inject a mouse event into the browser.
   * @param params - Mouse event parameters
   * @param _threadId - Unused in BrowserViewer (single connection)
   */
  async injectMouseEvent(params: MouseEventParams, _threadId?: string): Promise<void> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }

    // Input commands must be sent to the active target's session
    if (!this.activeTargetId) {
      throw new Error('No active target for input injection');
    }

    // Ensure target is attached before sending input
    const target = this.pageTargets.get(this.activeTargetId);
    if (!target?.sessionId) {
      await this.attachToTarget(this.activeTargetId);
    }

    await this.sendToTarget(
      this.activeTargetId,
      'Input.dispatchMouseEvent',
      params as unknown as Record<string, unknown>,
    );
  }

  /**
   * Inject a keyboard event into the browser.
   * @param params - Keyboard event parameters
   * @param _threadId - Unused in BrowserViewer (single connection)
   */
  async injectKeyboardEvent(params: KeyboardEventParams, _threadId?: string): Promise<void> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }

    // Input commands must be sent to the active target's session
    if (!this.activeTargetId) {
      throw new Error('No active target for input injection');
    }

    // Ensure target is attached before sending input
    const target = this.pageTargets.get(this.activeTargetId);
    if (!target?.sessionId) {
      this.logger.debug?.(`[BrowserViewer] No session for target ${this.activeTargetId}, attaching...`);
      await this.attachToTarget(this.activeTargetId);
    }

    await this.sendToTarget(
      this.activeTargetId,
      'Input.dispatchKeyEvent',
      params as unknown as Record<string, unknown>,
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation (for convenience - agent should use CLI instead)
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a URL.
   * Note: For agent automation, use the CLI instead.
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.cdpClient?.isConnected) {
      throw new Error('Not connected to browser');
    }

    // Page.navigate must be sent to the active target's session
    if (!this.activeTargetId) {
      throw new Error('No active target for navigation');
    }

    await this.sendToTarget(this.activeTargetId, 'Page.navigate', { url });
    this.lastUrl = url;
  }
}
