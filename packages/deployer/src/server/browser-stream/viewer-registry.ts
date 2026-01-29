import type { WSContext } from 'hono/ws';

import type { StatusMessage, BrowserStreamConfig } from './types.js';

/** Minimal screencast stream interface matching BrowserToolsetLike.startScreencast return type */
interface ScreencastStreamLike {
  on(event: 'frame', handler: (frame: { data: string; viewport: { width: number; height: number } }) => void): void;
  on(event: 'stop', handler: (reason: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  stop(): Promise<void>;
}

/**
 * ViewerRegistry manages WebSocket connections per agent and controls screencast lifecycle.
 *
 * Key responsibilities:
 * - Track connected viewers per agentId
 * - Start screencast when browser becomes active (not on viewer connect)
 * - Stop screencast when last viewer disconnects
 * - Broadcast frames to all viewers for an agent
 *
 * The browser is NOT launched when viewers connect - it only starts streaming
 * when the browser is already running from agent tool usage.
 *
 * @example
 * ```typescript
 * const registry = new ViewerRegistry();
 *
 * // When a viewer connects
 * registry.addViewer('agent-123', ws, getToolset);
 *
 * // When a viewer disconnects
 * registry.removeViewer('agent-123', ws);
 * ```
 */
export class ViewerRegistry {
  /** Map of agentId to set of connected WebSocket contexts */
  private viewers = new Map<string, Set<WSContext>>();

  /** Map of agentId to active screencast stream */
  private screencasts = new Map<string, ScreencastStreamLike>();

  /** Map of agentId to cleanup function for onBrowserReady callback */
  private browserReadyCleanups = new Map<string, () => void>();

  /** Map of agentId to last known URL (for dedup) */
  private lastUrls = new Map<string, string>();

  /**
   * Add a viewer for an agent. Starts screencast if this is the first viewer.
   *
   * @param agentId - The agent ID to stream from
   * @param ws - The WebSocket context for this viewer
   * @param getToolset - Function to retrieve the BrowserToolset for this agent
   */
  async addViewer(agentId: string, ws: WSContext, getToolset: BrowserStreamConfig['getToolset']): Promise<void> {
    // Get or create the viewer set for this agent
    let viewerSet = this.viewers.get(agentId);
    if (!viewerSet) {
      viewerSet = new Set();
      this.viewers.set(agentId, viewerSet);
    }

    const wasEmpty = viewerSet.size === 0;
    viewerSet.add(ws);

    // Start screencast if this is the first viewer
    if (wasEmpty) {
      await this.startScreencast(agentId, getToolset);
    }
  }

  /**
   * Remove a viewer for an agent. Stops screencast if this was the last viewer.
   *
   * @param agentId - The agent ID
   * @param ws - The WebSocket context to remove
   */
  async removeViewer(agentId: string, ws: WSContext): Promise<void> {
    const viewerSet = this.viewers.get(agentId);
    if (!viewerSet) {
      return;
    }

    viewerSet.delete(ws);

    // Clean up if no more viewers
    if (viewerSet.size === 0) {
      this.viewers.delete(agentId);
      this.lastUrls.delete(agentId);

      // Clean up browser ready callback if pending
      const cleanup = this.browserReadyCleanups.get(agentId);
      if (cleanup) {
        cleanup();
        this.browserReadyCleanups.delete(agentId);
      }

      await this.stopScreencast(agentId);
    }
  }

  /**
   * Broadcast a binary frame to all viewers for an agent.
   *
   * @param agentId - The agent ID
   * @param data - The binary frame data (base64 encoded)
   */
  broadcastFrame(agentId: string, data: string): void {
    const viewerSet = this.viewers.get(agentId);
    if (!viewerSet) {
      return;
    }

    // Send as binary (base64 string)
    for (const ws of viewerSet) {
      try {
        ws.send(data);
      } catch (error) {
        console.warn('[ViewerRegistry] Error broadcasting frame:', error);
      }
    }
  }

  /**
   * Broadcast a status message to all viewers for an agent.
   *
   * @param agentId - The agent ID
   * @param status - The status message to send
   */
  broadcastStatus(agentId: string, status: StatusMessage): void {
    const viewerSet = this.viewers.get(agentId);
    if (!viewerSet) {
      return;
    }

    const message = JSON.stringify(status);
    for (const ws of viewerSet) {
      try {
        ws.send(message);
      } catch (error) {
        console.warn('[ViewerRegistry] Error broadcasting status:', error);
      }
    }
  }

  /**
   * Broadcast a URL update to all viewers for an agent (only if changed).
   */
  private broadcastUrlIfChanged(agentId: string, url: string | null): void {
    if (!url) return;
    if (this.lastUrls.get(agentId) === url) return;

    this.lastUrls.set(agentId, url);

    const viewerSet = this.viewers.get(agentId);
    if (!viewerSet) return;

    const message = JSON.stringify({ url });
    for (const ws of viewerSet) {
      try {
        ws.send(message);
      } catch (error) {
        console.warn('[ViewerRegistry] Error broadcasting URL:', error);
      }
    }
  }

  /**
   * Start screencast for an agent. Only starts if browser is already running.
   * If browser not running, registers a callback to start when browser becomes ready.
   */
  private async startScreencast(agentId: string, getToolset: BrowserStreamConfig['getToolset']): Promise<void> {
    const toolset = getToolset(agentId);
    if (!toolset) {
      // No browser available for this agent - just keep connection open
      console.info(`[ViewerRegistry] No toolset for agent ${agentId}, waiting...`);
      return;
    }

    // Check if browser is already running
    if (toolset.isBrowserRunning()) {
      // Browser is running, start screencast immediately
      await this.doStartScreencast(agentId, toolset);
    } else {
      // Browser not running - register callback to start when it becomes ready
      console.info(`[ViewerRegistry] Browser not running for ${agentId}, waiting for browser to start...`);

      // Register callback for when browser launches
      const cleanup = toolset.onBrowserReady(() => {
        // Only start if we still have viewers
        if (this.viewers.has(agentId) && !this.screencasts.has(agentId)) {
          console.info(`[ViewerRegistry] Browser ready for ${agentId}, starting screencast...`);
          this.doStartScreencast(agentId, toolset).catch(error => {
            console.error(`[ViewerRegistry] Failed to start screencast on browser ready for ${agentId}:`, error);
          });
        }
      });

      // Store cleanup function
      this.browserReadyCleanups.set(agentId, cleanup);
    }
  }

  /**
   * Internal method to actually start the screencast stream.
   */
  private async doStartScreencast(
    agentId: string,
    toolset: NonNullable<ReturnType<BrowserStreamConfig['getToolset']>>,
  ): Promise<void> {
    // Skip if already streaming
    if (this.screencasts.has(agentId)) {
      return;
    }

    try {
      this.broadcastStatus(agentId, { status: 'browser_starting' });

      // Use startScreencastIfBrowserActive to avoid launching browser
      const stream = await toolset.startScreencastIfBrowserActive();
      if (!stream) {
        console.warn(`[ViewerRegistry] Browser no longer active for ${agentId}`);
        return;
      }

      this.screencasts.set(agentId, stream);

      // Wire up frame events + URL tracking
      stream.on('frame', frame => {
        this.broadcastFrame(agentId, frame.data);
        this.broadcastUrlIfChanged(agentId, toolset.getCurrentUrl());
      });

      // Wire up stop events
      stream.on('stop', reason => {
        console.info(`[ViewerRegistry] Screencast stopped for ${agentId}: ${reason}`);
        this.screencasts.delete(agentId);
        this.broadcastStatus(agentId, { status: 'browser_closed' });
      });

      // Wire up error events
      stream.on('error', error => {
        console.error(`[ViewerRegistry] Screencast error for ${agentId}:`, error);
      });

      this.broadcastStatus(agentId, { status: 'streaming' });

      // Send initial URL
      this.broadcastUrlIfChanged(agentId, toolset.getCurrentUrl());
    } catch (error) {
      console.error(`[ViewerRegistry] Failed to start screencast for ${agentId}:`, error);
      // Connection stays open - user can see error status
    }
  }

  /**
   * Stop screencast for an agent. Called when last viewer disconnects.
   */
  private async stopScreencast(agentId: string): Promise<void> {
    const stream = this.screencasts.get(agentId);
    if (!stream) {
      return;
    }

    try {
      await stream.stop();
    } catch (error) {
      console.warn(`[ViewerRegistry] Error stopping screencast for ${agentId}:`, error);
    } finally {
      this.screencasts.delete(agentId);
    }
  }

  /**
   * Get the number of viewers for an agent.
   *
   * @param agentId - The agent ID
   * @returns The number of connected viewers
   */
  getViewerCount(agentId: string): number {
    return this.viewers.get(agentId)?.size ?? 0;
  }

  /**
   * Check if an agent has an active screencast.
   *
   * @param agentId - The agent ID
   * @returns True if screencast is active
   */
  hasActiveScreencast(agentId: string): boolean {
    return this.screencasts.has(agentId);
  }

  /**
   * Close the browser session for an agent.
   * Stops screencast and broadcasts browser_closed status.
   * Call this before calling toolset.close() to ensure UI is notified.
   *
   * @param agentId - The agent ID
   */
  async closeBrowserSession(agentId: string): Promise<void> {
    // NOTE: Do NOT clean up the onBrowserReady callback here.
    // Viewers are still connected (WebSocket stays open), so we need
    // the callback to fire when the browser relaunches from a subsequent
    // tool call. Callback cleanup only happens in removeViewer() when
    // the last viewer disconnects.

    // Clear URL tracking so next session sends fresh URL
    this.lastUrls.delete(agentId);

    // Stop screencast if active
    const stream = this.screencasts.get(agentId);
    if (stream) {
      try {
        await stream.stop();
        // Note: stream.stop() emits 'stop' event which triggers broadcastStatus
      } catch (error) {
        console.warn(`[ViewerRegistry] Error stopping screencast for ${agentId}:`, error);
        // Still broadcast browser_closed even if stop fails
        this.screencasts.delete(agentId);
        this.broadcastStatus(agentId, { status: 'browser_closed' });
      }
    } else {
      // No active screencast, but still broadcast browser_closed
      this.broadcastStatus(agentId, { status: 'browser_closed' });
    }
  }
}
