/**
 * BrowserUseThreadManager - Thread isolation for BrowserUseBrowser
 *
 * Manages thread-scoped cloud browser sessions using browser-use SDK.
 * Each thread can have its own cloud browser session with CDP access.
 */

import { ThreadManager } from '@mastra/core/browser';
import type { ThreadSession, ThreadManagerConfig } from '@mastra/core/browser';
import { BrowserUse } from 'browser-use-sdk';
import type { BrowserConfig, BrowserSessionInfo } from './types';

/**
 * Extended session info for BrowserUseBrowser.
 * Stores the cloud session info and CDP URL.
 */
interface BrowserUseSession extends ThreadSession {
  /** Cloud session info from the SDK */
  sessionInfo?: BrowserSessionInfo;
  /** CDP WebSocket URL for this session */
  cdpUrl?: string;
}

/**
 * Configuration for BrowserUseThreadManager.
 */
export interface BrowserUseThreadManagerConfig extends Omit<ThreadManagerConfig, 'onSessionCreated'> {
  /** Browser configuration */
  browserConfig: BrowserConfig;
  /** Callback when a new cloud session is created for a thread */
  onSessionCreated?: (sessionInfo: BrowserSessionInfo, threadId: string) => void;
}

/**
 * Thread manager implementation for BrowserUseBrowser.
 *
 * Supports two isolation modes:
 * - 'none': All threads share a single cloud browser session
 * - 'browser': Each thread gets a dedicated cloud browser session
 */
export class BrowserUseThreadManager extends ThreadManager<BrowserSessionInfo> {
  private sharedSession: BrowserSessionInfo | null = null;
  private readonly browserConfig: BrowserConfig;
  private readonly onSessionCreatedCallback?: (sessionInfo: BrowserSessionInfo, threadId: string) => void;

  /** Browser Use SDK client */
  private client: BrowserUse;

  /** Map of thread ID to cloud session info (for 'browser' mode) */
  private readonly threadSessions = new Map<string, BrowserSessionInfo>();

  constructor(config: BrowserUseThreadManagerConfig) {
    super({ scope: config.scope, logger: config.logger });
    this.browserConfig = config.browserConfig;
    this.onSessionCreatedCallback = config.onSessionCreated;

    // Initialize the SDK client
    const apiKey = config.browserConfig.apiKey || process.env.BROWSER_USE_API_KEY;
    if (!apiKey) {
      throw new Error('Browser Use API key is required. Set apiKey in config or BROWSER_USE_API_KEY env var.');
    }
    this.client = new BrowserUse({ apiKey });
  }

  /**
   * Set the shared session (for 'none' isolation mode).
   */
  setSharedSession(sessionInfo: BrowserSessionInfo): void {
    this.sharedSession = sessionInfo;
  }

  /**
   * Get the shared session.
   */
  getSharedSession(): BrowserSessionInfo | null {
    return this.sharedSession;
  }

  /**
   * Clear the shared session (called on disconnect).
   */
  clearSharedSession(): void {
    this.sharedSession = null;
  }

  /**
   * Get the SDK client for running AI tasks.
   */
  getClient(): BrowserUse {
    return this.client;
  }

  /**
   * Get the shared manager (required by base class).
   * For browser-use, this returns the shared session info.
   */
  protected override getSharedManager(): BrowserSessionInfo {
    if (!this.sharedSession) {
      throw new Error('No shared session available. Call setSharedSession first.');
    }
    return this.sharedSession;
  }

  /**
   * Check if there are any active thread sessions.
   */
  hasActiveThreadSessions(): boolean {
    return this.threadSessions.size > 0;
  }

  /**
   * Get an existing session for a thread (without creating).
   */
  getExistingSessionForThread(threadId: string): BrowserSessionInfo | null {
    return this.threadSessions.get(threadId) ?? null;
  }

  /**
   * Get the CDP URL for a thread.
   */
  getCdpUrlForThread(threadId: string): string | null {
    const session = this.threadSessions.get(threadId);
    return session?.cdpUrl ?? null;
  }

  /**
   * Create a new cloud browser session for a thread.
   */
  protected override async createSession(threadId: string): Promise<BrowserUseSession> {
    // Check if session already exists
    const existing = this.threadSessions.get(threadId);
    if (existing) {
      return {
        threadId,
        createdAt: Date.now(),
        browserState: this.getSavedBrowserState(threadId),
        sessionInfo: existing,
        cdpUrl: existing.cdpUrl ?? undefined,
      };
    }

    // Create a new cloud session via the SDK
    const sessionResponse = await this.client.browsers.create({
      profileId: this.browserConfig.profileId ?? undefined,
      proxyCountryCode: (this.browserConfig.proxyCountryCode as 'us') ?? 'us',
      timeout: this.browserConfig.sessionTimeout ?? 60,
      browserScreenWidth: this.browserConfig.viewport?.width,
      browserScreenHeight: this.browserConfig.viewport?.height,
      enableRecording: this.browserConfig.enableRecording ?? false,
    });

    const sessionInfo: BrowserSessionInfo = {
      id: sessionResponse.id,
      cdpUrl: sessionResponse.cdpUrl ?? null,
      liveUrl: sessionResponse.liveUrl ?? null,
      status: sessionResponse.status as 'active' | 'stopped',
      timeoutAt: sessionResponse.timeoutAt,
    };

    // Store the session
    this.threadSessions.set(threadId, sessionInfo);

    // Notify callback
    if (this.onSessionCreatedCallback) {
      this.onSessionCreatedCallback(sessionInfo, threadId);
    }

    return {
      threadId,
      createdAt: Date.now(),
      browserState: this.getSavedBrowserState(threadId),
      sessionInfo,
      cdpUrl: sessionInfo.cdpUrl ?? undefined,
    };
  }



  /**
   * Get the browser manager (session info) for a specific session.
   */
  protected override getManagerForSession(session: ThreadSession): BrowserSessionInfo {
    const browserUseSession = session as BrowserUseSession;
    if (browserUseSession.sessionInfo) {
      return browserUseSession.sessionInfo;
    }
    // Fall back to looking up in our map
    const info = this.threadSessions.get(session.threadId);
    if (!info) {
      throw new Error(`No session info found for thread: ${session.threadId}`);
    }
    return info;
  }

  /**
   * Destroy a session and clean up resources.
   */
  protected override async doDestroySession(session: ThreadSession): Promise<void> {
    const info = this.threadSessions.get(session.threadId);
    if (info) {
      // Stop the cloud session
      try {
        await this.client.browsers.stop(info.id);
      } catch {
        // Ignore errors when stopping (session may already be stopped)
      }
      this.threadSessions.delete(session.threadId);
    }
  }

  /**
   * Check if a thread has an active session.
   */
  override hasSession(threadId: string): boolean {
    return this.threadSessions.has(threadId) || super.hasSession(threadId);
  }

  /**
   * Destroy all sessions including the shared one.
   */
  async destroyAll(): Promise<void> {
    // Destroy all thread sessions via base class
    await this.destroyAllSessions();

    // Stop shared session if exists
    if (this.sharedSession) {
      try {
        await this.client.browsers.stop(this.sharedSession.id);
      } catch {
        // Ignore errors
      }
      this.clearSharedSession();
    }
  }

  /**
   * Get session info for a thread (for 'browser' mode).
   */
  getSessionInfo(threadId: string): BrowserSessionInfo | null {
    return this.threadSessions.get(threadId) ?? null;
  }

  /**
   * Get all active thread IDs.
   */
  getActiveThreadIds(): string[] {
    return Array.from(this.threadSessions.keys());
  }

  /**
   * Create a cloud session directly (used by the browser class for 'none' mode).
   */
  async createCloudSession(): Promise<BrowserSessionInfo> {
    const sessionResponse = await this.client.browsers.create({
      profileId: this.browserConfig.profileId ?? undefined,
      proxyCountryCode: (this.browserConfig.proxyCountryCode as 'us') ?? 'us',
      timeout: this.browserConfig.sessionTimeout ?? 60,
      browserScreenWidth: this.browserConfig.viewport?.width,
      browserScreenHeight: this.browserConfig.viewport?.height,
      enableRecording: this.browserConfig.enableRecording ?? false,
    });

    return {
      id: sessionResponse.id,
      cdpUrl: sessionResponse.cdpUrl ?? null,
      liveUrl: sessionResponse.liveUrl ?? null,
      status: sessionResponse.status as 'active' | 'stopped',
      timeoutAt: sessionResponse.timeoutAt,
    };
  }

  /**
   * Stop a cloud session by ID.
   */
  async stopCloudSession(sessionId: string): Promise<void> {
    try {
      await this.client.browsers.stop(sessionId);
    } catch {
      // Ignore errors
    }
  }
}
