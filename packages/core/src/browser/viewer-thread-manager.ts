/**
 * BrowserViewerThreadManager - Thread isolation for BrowserViewer
 *
 * Manages thread-scoped browser sessions using process-based isolation.
 * Each thread can have its own browser process spawned via processManager.
 */

import type { ProcessHandle, SandboxProcessManager } from '../workspace/sandbox/process-manager';
import { ThreadManager } from './thread-manager';
import type { ThreadSession, ThreadManagerConfig } from './thread-manager';
import type { BrowserViewerConfig, BuiltInCLIProvider, CLIProvider, PageTarget } from './viewer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents a CDP connection for a thread.
 */
export interface ThreadCdpConnection {
  /** WebSocket URL for CDP connection */
  cdpUrl: string;
  /** Browser process handle (if spawned via processManager) */
  processHandle?: ProcessHandle;
  /** Map of targetId -> PageTarget for multi-tab tracking */
  pageTargets: Map<string, PageTarget>;
  /** Currently active target ID */
  activeTargetId: string | null;
}

/**
 * Extended session info for BrowserViewer.
 */
export interface BrowserViewerSession extends ThreadSession {
  /** CDP connection info for this thread */
  connection?: ThreadCdpConnection;
}

/**
 * Configuration for BrowserViewerThreadManager.
 */
export interface BrowserViewerThreadManagerConfig extends ThreadManagerConfig {
  /** Browser viewer configuration */
  viewerConfig: BrowserViewerConfig;
  /** Process manager for spawning browsers */
  processManager?: SandboxProcessManager;
  /** CLI provider to use */
  cli?: CLIProvider;
  /** Callback when a new browser connection is established for a thread */
  onBrowserCreated?: (connection: ThreadCdpConnection, threadId: string) => void;
  /** Function to discover CDP URL from a process */
  discoverCdpUrl?: (processHandle: ProcessHandle) => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// CLI Provider Commands
// ---------------------------------------------------------------------------

export const CLI_PROVIDER_COMMANDS: Record<BuiltInCLIProvider, { binary: string; npxPackage: string }> = {
  'agent-browser': { binary: 'agent-browser', npxPackage: 'agent-browser' },
  'browser-use': { binary: 'browser-use', npxPackage: '@anthropic-ai/browser-use-cli' },
};

// ---------------------------------------------------------------------------
// BrowserViewerThreadManager
// ---------------------------------------------------------------------------

/**
 * Thread manager implementation for BrowserViewer.
 *
 * Supports two isolation modes:
 * - 'none': All threads share a single browser connection
 * - 'browser': Each thread gets its own browser process and CDP connection
 */
export class BrowserViewerThreadManager extends ThreadManager<ThreadCdpConnection> {
  private sharedConnection: ThreadCdpConnection | null = null;
  private readonly processManager?: SandboxProcessManager;
  private readonly cli?: CLIProvider;
  private readonly onBrowserCreated?: (connection: ThreadCdpConnection, threadId: string) => void;
  private readonly discoverCdpUrl?: (processHandle: ProcessHandle) => Promise<string | null>;

  /** Map of thread ID to dedicated browser connection (for 'browser' mode) */
  private readonly threadConnections = new Map<string, ThreadCdpConnection>();

  constructor(config: BrowserViewerThreadManagerConfig) {
    super(config);
    this.processManager = config.processManager;
    this.cli = config.cli ?? config.viewerConfig.cli;
    this.onBrowserCreated = config.onBrowserCreated;
    this.discoverCdpUrl = config.discoverCdpUrl;
  }

  /**
   * Set the shared browser connection (called after browser launch).
   */
  setSharedConnection(connection: ThreadCdpConnection): void {
    this.sharedConnection = connection;
  }

  /**
   * Clear the shared browser connection (called when browser disconnects).
   */
  clearSharedConnection(): void {
    this.sharedConnection = null;
  }

  /**
   * Get the shared browser connection.
   */
  protected getSharedManager(): ThreadCdpConnection {
    if (!this.sharedConnection) {
      throw new Error('Browser not connected');
    }
    return this.sharedConnection;
  }

  /**
   * Get all thread connections (for cleanup).
   */
  getAllConnections(): Map<string, ThreadCdpConnection> {
    return this.threadConnections;
  }

  /**
   * Create a new session for a thread.
   */
  protected async createSession(threadId: string): Promise<BrowserViewerSession> {
    // Check for saved browser state before creating new session (for browser restore)
    const savedState = this.getSavedBrowserState(threadId);

    const session: BrowserViewerSession = {
      threadId,
      createdAt: Date.now(),
      browserState: savedState,
    };

    if (this.getScope() === 'thread') {
      // Full thread scope - spawn a new browser process
      const connection = await this.spawnBrowserForThread(threadId);
      session.connection = connection;
      this.threadConnections.set(threadId, connection);

      // Notify parent browser so it can set up CDP client and screencast
      // State restoration happens in BrowserViewer after CDP connection is established
      this.onBrowserCreated?.(connection, threadId);
    }
    // For 'shared' scope, no session setup needed - all threads share the connection

    return session;
  }

  /**
   * Spawn a new browser process for a thread.
   */
  private async spawnBrowserForThread(threadId: string): Promise<ThreadCdpConnection> {
    if (!this.processManager) {
      throw new Error('processManager required for thread scope mode');
    }

    const cli = this.cli;
    if (!cli) {
      throw new Error('CLI provider required for thread scope mode');
    }

    let fullCommand: string;

    if (typeof cli === 'string') {
      // Built-in CLI provider
      const commands = CLI_PROVIDER_COMMANDS[cli];
      if (!commands) {
        throw new Error(`Unknown CLI provider: ${cli}`);
      }

      // Build the CLI command with remote-debugging-port
      // Each thread gets a unique port (or we let Chrome pick one)
      const openArgs = ['open', '--remote-debugging-port=0']; // 0 = auto-assign port

      // Check if binary exists, otherwise use npx
      const useNpx = !this.commandExists(commands.binary);
      const cmdParts = useNpx ? ['npx', commands.npxPackage, ...openArgs] : [commands.binary, ...openArgs];
      fullCommand = cmdParts.join(' ');
    } else {
      // Custom CLI provider - use getCdpUrlCommand as-is
      // Custom providers need to handle their own process spawning
      throw new Error('Custom CLI providers are not supported for thread scope mode');
    }

    this.logger?.debug?.(`[BrowserViewerThreadManager] Spawning browser for thread ${threadId}: ${fullCommand}`);

    const processHandle = await this.processManager.spawn(fullCommand);

    this.logger?.debug?.(`[BrowserViewerThreadManager] Spawned browser process with PID: ${processHandle.pid}`);

    // Wait for the browser to start and expose CDP port
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Discover CDP URL from the spawned process
    let cdpUrl: string | null = null;
    if (this.discoverCdpUrl) {
      cdpUrl = await this.discoverCdpUrl(processHandle);
    }

    if (!cdpUrl) {
      // Kill the process since we can't connect
      await processHandle.kill();
      throw new Error(`Failed to discover CDP URL for thread ${threadId}`);
    }

    this.logger?.debug?.(`[BrowserViewerThreadManager] Discovered CDP URL for thread ${threadId}: ${cdpUrl}`);

    return {
      cdpUrl,
      processHandle,
      pageTargets: new Map(),
      activeTargetId: null,
    };
  }

  /**
   * Check if a command exists in PATH.
   */
  private commandExists(_command: string): boolean {
    // Simple check - this will be platform-specific
    // For now, assume npx is always available as fallback
    return false;
  }

  /**
   * Switch to an existing session.
   * For 'browser' mode, no switching needed - each thread has its own connection.
   * For 'none' mode, nothing to switch.
   */
  protected async switchToSession(_session: BrowserViewerSession): Promise<void> {
    // No-op for BrowserViewer - each thread has independent state
  }

  /**
   * Get the browser connection for a specific session.
   */
  protected getManagerForSession(session: BrowserViewerSession): ThreadCdpConnection {
    if (this.getScope() === 'thread' && session.connection) {
      return session.connection;
    }
    return this.getSharedManager();
  }

  /**
   * Destroy a session and clean up resources.
   */
  protected async doDestroySession(session: BrowserViewerSession): Promise<void> {
    if (session.connection?.processHandle) {
      this.logger?.debug?.(`[BrowserViewerThreadManager] Killing browser process for thread ${session.threadId}`);
      await session.connection.processHandle.kill();
    }
    this.threadConnections.delete(session.threadId);
  }

  /**
   * Clear a session (save state, then destroy).
   * Called when a thread is done or browser disconnects.
   */
  async clearSession(threadId: string): Promise<void> {
    const session = this.sessions.get(threadId) as BrowserViewerSession | undefined;
    if (!session) {
      return;
    }

    // Save the browser state before clearing so it can be restored on relaunch
    if (session.browserState) {
      this.logger?.debug?.(
        `[BrowserViewerThreadManager] clearSession saving ${session.browserState.tabs.length} tabs, activeIndex=${session.browserState.activeTabIndex}`,
      );
      this.savedBrowserStates.set(threadId, session.browserState);
    }

    await this.destroySession(threadId);
  }

  /**
   * Destroy all sessions and kill all browser processes.
   */
  override async destroyAllSessions(): Promise<void> {
    // Kill all thread-specific browser processes
    for (const [threadId, connection] of this.threadConnections) {
      if (connection.processHandle) {
        this.logger?.debug?.(`[BrowserViewerThreadManager] Killing browser process for thread ${threadId}`);
        await connection.processHandle.kill().catch(() => {});
      }
    }
    this.threadConnections.clear();

    await super.destroyAllSessions();
  }
}
