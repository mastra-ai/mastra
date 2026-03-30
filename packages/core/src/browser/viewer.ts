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
import type { BrowserConfig, MouseEventParams, KeyboardEventParams } from './browser';
import { ScreencastStream } from './screencast/screencast-stream';
import type { CdpSessionLike, CdpSessionProvider, ScreencastOptions } from './screencast/types';

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

export interface BrowserViewerConfig extends BrowserConfig {
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
              this.emit(message.method, message.params);
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

      const message = JSON.stringify({ id, method, params });
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
  private cdpClient: CdpClient | null = null;
  private _screencastStream: ScreencastStream | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastCdpUrl: string | null = null;
  private browserPollTimer: ReturnType<typeof setTimeout> | null = null;
  private _isPollingForBrowser = false;

  /**
   * Handle to the browser process spawned via processManager.
   * Used for CDP port discovery and cleanup.
   */
  private browserProcess: ProcessHandle | null = null;

  constructor(config: BrowserViewerConfig = {}) {
    super(config);
    this.viewerConfig = config;
    this.id = `browser-viewer-${Date.now()}`;
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
    // Disconnect CDP connection first
    await this.disconnect();

    // If we spawned the browser via processManager, kill it
    if (this.browserProcess) {
      this.logger.debug?.(`[BrowserViewer] Killing browser process ${this.browserProcess.pid}`);
      await this.browserProcess.kill();
      this.browserProcess = null;
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
   */
  async connect(): Promise<void> {
    if (this.cdpClient?.isConnected) {
      return; // Already connected
    }

    const cdpUrl = await this.getCdpUrl();
    this._lastCdpUrl = cdpUrl;
    this.cdpClient = new CdpClient();

    try {
      await this.cdpClient.connect(cdpUrl);

      // Enable Page domain for screencast
      await this.cdpClient.send('Page.enable');

      this.logger.debug?.(`[BrowserViewer] Connected to CDP: ${cdpUrl}`);
      this.notifyBrowserReady();

      // Handle disconnection
      this.cdpClient.on('close', () => {
        this.handleDisconnect();
      });
    } catch (error) {
      this.logger.debug?.(`[BrowserViewer] Connection failed: ${error}`);
      this.cdpClient = null;
      throw error;
    }
  }

  /**
   * Get the CDP WebSocket URL from the configured source.
   */
  private async getCdpUrl(): Promise<string> {
    // Direct CDP URL takes precedence
    if (this.viewerConfig.cdpUrl) {
      if (typeof this.viewerConfig.cdpUrl === 'function') {
        return await this.viewerConfig.cdpUrl();
      }
      return this.viewerConfig.cdpUrl;
    }

    // Get CDP URL from CLI provider
    if (this.viewerConfig.cli) {
      return await this.getCdpUrlFromCLI();
    }

    throw new Error('No CDP URL source configured. Provide either `cdpUrl` or `cli` in config.');
  }

  /**
   * Get the CDP URL from the CLI provider.
   */
  private async getCdpUrlFromCLI(): Promise<string> {
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
            return await this.getPageCdpUrl(cdpUrl);
          }
        } catch {
          // Command failed - fall back to process discovery
        }
      }

      // Fallback: discover CDP port from running Chrome processes
      const cdpUrl = await this.discoverCdpFromProcesses();
      if (cdpUrl) {
        return await this.getPageCdpUrl(cdpUrl);
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

        return await this.getPageCdpUrl(cdpUrl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to get CDP URL from CLI: ${message}`);
      }
    }
  }

  /**
   * Discover CDP port by inspecting running Chrome/Chromium processes.
   * Looks for --remote-debugging-port argument in process command lines.
   *
   * When browserProcess is tracked (via processManager), searches only child
   * processes of that PID for better isolation. Otherwise, searches globally.
   */
  private async discoverCdpFromProcesses(): Promise<string | null> {
    try {
      let cmd: string;

      if (this.browserProcess && process.platform !== 'win32') {
        // We have a tracked browser process - search its child processes only
        // This provides thread isolation (each viewer only sees its own browser)
        const pid = this.browserProcess.pid;

        // Use pgrep to find child processes, then get their command lines
        cmd = `pgrep -P ${pid} | xargs -I{} ps -p {} -o command= 2>/dev/null | grep -E 'remote-debugging-port'`;
      } else {
        // No tracked process - fall back to global search
        // Works on macOS/Linux; Windows would need different approach
        cmd =
          process.platform === 'win32'
            ? "wmic process where \"name like '%chrome%' or name like '%chromium%'\" get commandline 2>nul"
            : "ps aux | grep -E 'chrome|chromium' | grep 'remote-debugging-port' | grep -v grep";
      }

      const result = await this.execCommand(cmd);
      const output = result.stdout;

      // Extract all unique ports from --remote-debugging-port=XXXXX
      const portMatches = output.matchAll(/--remote-debugging-port=(\d+)/g);
      const ports = [...new Set([...portMatches].map(m => m[1]).filter(p => p !== '0'))];

      // Try each port, return first accessible one
      for (const port of ports.reverse()) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
            signal: AbortSignal.timeout(1000),
          });
          if (response.ok) {
            const data = (await response.json()) as { webSocketDebuggerUrl?: string };
            if (data.webSocketDebuggerUrl) {
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
   * Convert a browser-level CDP URL to a page-level CDP URL.
   * Queries the /json endpoint to find a page target.
   */
  private async getPageCdpUrl(browserCdpUrl: string): Promise<string> {
    // Extract host and port from the browser CDP URL
    // Format: ws://127.0.0.1:9222/devtools/browser/...
    const match = browserCdpUrl.match(/^wss?:\/\/([^/]+)/);
    if (!match) {
      return browserCdpUrl; // Can't parse, return as-is
    }

    const hostPort = match[1];
    const jsonUrl = `http://${hostPort}/json`;

    try {
      // Fetch the list of targets
      const response = await fetch(jsonUrl);
      if (!response.ok) {
        return browserCdpUrl; // Fallback to browser URL
      }

      const targets = (await response.json()) as Array<{
        type: string;
        url: string;
        webSocketDebuggerUrl?: string;
      }>;

      // Find a page target (not an iframe or other type)
      // Prefer non-chrome:// pages
      const pageTargets = targets.filter(t => t.type === 'page');
      const regularPage = pageTargets.find(t => !t.url.startsWith('chrome://'));
      const target = regularPage || pageTargets[0];

      if (target?.webSocketDebuggerUrl) {
        return target.webSocketDebuggerUrl;
      }

      return browserCdpUrl; // Fallback to browser URL
    } catch {
      return browserCdpUrl; // Fallback to browser URL on error
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
    this.clearReconnectTimer();
    this.stopPollingForBrowser();

    if (this._screencastStream) {
      await this._screencastStream.stop();
      this._screencastStream = null;
    }

    if (this.cdpClient) {
      await this.cdpClient.detach();
      this.cdpClient = null;
    }
  }

  private handleDisconnect(): void {
    this.cdpClient = null;
    this.notifyBrowserClosed();

    if (this.config.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.logger.error('Failed to reconnect to browser', error);
        this.scheduleReconnect();
      });
    }, this.config.reconnectDelay ?? 1000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
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

  async getCdpSession(): Promise<CdpSessionLike> {
    if (!this.cdpClient) {
      throw new Error('Not connected to browser');
    }
    return this.cdpClient;
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
    const onFrameNavigated = (params: { frame: { url: string; parentId?: string } }) => {
      // Only emit URL for main frame navigations (no parentId)
      if (!params.frame.parentId && params.frame.url) {
        this.lastUrl = params.frame.url;
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
   */
  override getLastUrl(): string | undefined {
    return this.lastUrl;
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

    await this.cdpClient.send('Input.dispatchMouseEvent', params as unknown as Record<string, unknown>);
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

    await this.cdpClient.send('Input.dispatchKeyEvent', params as unknown as Record<string, unknown>);
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

    await this.cdpClient.send('Page.navigate', { url });
    this.lastUrl = url;
  }
}
