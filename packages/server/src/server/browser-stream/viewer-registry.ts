import type {
  StatusMessage,
  BrowserStreamConfig,
  ViewportMessage,
  BrowserStreamWebSocket,
  ViewerRegistryLike,
} from './types.js';

/** Minimal screencast stream interface matching BrowserToolsetLike.startScreencast return type */
interface ScreencastStreamLike {
  on(event: 'frame', handler: (frame: { data: string; viewport: { width: number; height: number } }) => void): void;
  on(event: 'stop', handler: (reason: string) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'url', handler: (url: string) => void): void;
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
export class ViewerRegistry implements ViewerRegistryLike {
  /** Map of agentId to set of connected WebSocket contexts */
  private viewers = new Map<string, Set<BrowserStreamWebSocket>>();

  /** Map of agentId to active screencast stream */
  private screencasts = new Map<string, ScreencastStreamLike>();

  /** Set of viewerKeys currently starting a screencast (to prevent race conditions) */
  private startingScreencasts = new Set<string>();

  /** Map of agentId to cleanup function for onBrowserReady callback */
  private browserReadyCleanups = new Map<string, () => void>();

  /** Map of agentId to cleanup function for onBrowserClosed callback */
  private browserClosedCleanups = new Map<string, () => void>();

  /** Map of agentId to last known URL (for dedup) */
  private lastUrls = new Map<string, string>();

  /** Map of agentId to last known viewport dimensions (for change detection) */
  private lastViewports = new Map<string, { width: number; height: number }>();

  /** Map of viewerKey to last broadcast status (for replay to new viewers) */
  private lastStatuses = new Map<string, string>();

  /**
   * Add a viewer for an agent. Starts screencast if this is the first viewer.
   *
   * @param viewerKey - The viewer key (agentId or agentId:threadId for thread-scoped)
   * @param ws - The WebSocket context for this viewer
   * @param getToolset - Function to retrieve the BrowserToolset for this agent
   * @param agentId - The actual agent ID for toolset lookup (optional, defaults to viewerKey)
   * @param threadId - The thread ID for thread-scoped screencasts (optional)
   */
  async addViewer(
    viewerKey: string,
    ws: BrowserStreamWebSocket,
    getToolset: BrowserStreamConfig['getToolset'],
    agentId?: string,
    threadId?: string,
  ): Promise<void> {
    // Get or create the viewer set for this viewer key
    let viewerSet = this.viewers.get(viewerKey);
    if (!viewerSet) {
      viewerSet = new Set();
      this.viewers.set(viewerKey, viewerSet);
    }

    const wasEmpty = viewerSet.size === 0;
    viewerSet.add(ws);

    // Start screencast if this is the first viewer
    // Use agentId for toolset lookup, viewerKey for registry keying
    if (wasEmpty) {
      await this.startScreencast(viewerKey, getToolset, agentId ?? viewerKey, threadId);
    } else {
      // Send current state to new viewer (screencast already running)
      this.sendCurrentState(viewerKey, ws);
    }
  }

  /**
   * Send current state (URL, viewport) to a newly connected viewer.
   */
  private sendCurrentState(viewerKey: string, ws: BrowserStreamWebSocket): void {
    try {
      // Send last known URL
      const lastUrl = this.lastUrls.get(viewerKey);
      if (lastUrl) {
        ws.send(JSON.stringify({ url: lastUrl }));
      }

      // Send last known viewport
      const lastViewport = this.lastViewports.get(viewerKey);
      if (lastViewport) {
        ws.send(JSON.stringify({ viewport: lastViewport }));
      }

      // Send actual current status (not always 'streaming')
      const lastStatus = this.lastStatuses.get(viewerKey);
      if (lastStatus) {
        ws.send(JSON.stringify({ status: lastStatus }));
      }
    } catch (error) {
      console.warn('[ViewerRegistry] Error sending current state to new viewer:', error);
    }
  }

  /**
   * Remove a viewer. Stops screencast if this was the last viewer.
   *
   * @param viewerKey - The viewer key (agentId or agentId:threadId for thread-scoped)
   * @param ws - The WebSocket context to remove
   */
  async removeViewer(viewerKey: string, ws: BrowserStreamWebSocket): Promise<void> {
    const viewerSet = this.viewers.get(viewerKey);
    if (!viewerSet) {
      return;
    }

    viewerSet.delete(ws);

    // Clean up if no more viewers
    if (viewerSet.size === 0) {
      this.viewers.delete(viewerKey);
      this.lastUrls.delete(viewerKey);
      this.lastViewports.delete(viewerKey);

      // Clean up browser callbacks if pending
      const readyCleanup = this.browserReadyCleanups.get(viewerKey);
      if (readyCleanup) {
        readyCleanup();
        this.browserReadyCleanups.delete(viewerKey);
      }
      const closedCleanup = this.browserClosedCleanups.get(viewerKey);
      if (closedCleanup) {
        closedCleanup();
        this.browserClosedCleanups.delete(viewerKey);
      }

      await this.stopScreencast(viewerKey);
    }
  }

  /**
   * Broadcast a binary frame to all viewers.
   *
   * @param viewerKey - The viewer key (agentId or agentId:threadId for thread-scoped)
   * @param data - The binary frame data (base64 encoded)
   */
  broadcastFrame(viewerKey: string, data: string): void {
    const viewerSet = this.viewers.get(viewerKey);
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
   * Broadcast a status message to all viewers.
   *
   * @param viewerKey - The viewer key (agentId or agentId:threadId for thread-scoped)
   * @param status - The status message to send
   */
  broadcastStatus(viewerKey: string, status: StatusMessage): void {
    // Track last status for replay to new viewers
    if (status.status) {
      this.lastStatuses.set(viewerKey, status.status);
    }

    const viewerSet = this.viewers.get(viewerKey);
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
   * Broadcast a URL update to all viewers (only if changed).
   */
  private broadcastUrlIfChanged(viewerKey: string, url: string | null): void {
    if (!url) return;
    if (this.lastUrls.get(viewerKey) === url) return;

    this.lastUrls.set(viewerKey, url);

    const viewerSet = this.viewers.get(viewerKey);
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
   * Broadcast viewport metadata to all viewers.
   * Only sends if dimensions have changed from last broadcast.
   * Called on stream start and on each frame to detect dimension changes.
   */
  private broadcastViewportIfChanged(viewerKey: string, viewport: { width: number; height: number }): void {
    const last = this.lastViewports.get(viewerKey);
    if (last && last.width === viewport.width && last.height === viewport.height) {
      return;
    }

    this.lastViewports.set(viewerKey, { width: viewport.width, height: viewport.height });

    const viewerSet = this.viewers.get(viewerKey);
    if (!viewerSet) return;

    const message: ViewportMessage = { viewport: { width: viewport.width, height: viewport.height } };
    const json = JSON.stringify(message);
    for (const ws of viewerSet) {
      try {
        ws.send(json);
      } catch (error) {
        console.warn('[ViewerRegistry] Error broadcasting viewport:', error);
      }
    }
  }

  /**
   * Start screencast for a viewer. Only starts if browser is already running.
   * If browser not running, registers a callback to start when browser becomes ready.
   *
   * @param viewerKey - The viewer key (for registry keying)
   * @param getToolset - Function to retrieve the BrowserToolset
   * @param agentId - The actual agent ID for toolset lookup
   * @param threadId - The thread ID for thread-scoped page selection (optional)
   */
  private async startScreencast(
    viewerKey: string,
    getToolset: BrowserStreamConfig['getToolset'],
    agentId: string,
    threadId?: string,
  ): Promise<void> {
    const toolset = getToolset(agentId);
    if (!toolset) {
      // No browser available for this agent - just keep connection open
      console.info(`[ViewerRegistry] No toolset for ${viewerKey}, waiting...`);
      return;
    }

    // Register callback for browser restarts (external close + re-launch)
    // This ensures screencast reconnects after browser is externally closed
    // Pass threadId so callback only fires when that specific thread's browser is ready
    if (!this.browserReadyCleanups.has(viewerKey)) {
      const cleanup = toolset.onBrowserReady(() => {
        // Only start if we still have viewers
        if (!this.viewers.has(viewerKey)) {
          return;
        }

        // Stop any existing (likely dead) screencast before starting new one
        const existingStream = this.screencasts.get(viewerKey);
        if (existingStream) {
          console.info(`[ViewerRegistry] Stopping old screencast for ${viewerKey} before reconnecting...`);
          this.screencasts.delete(viewerKey);
          // Stop async, don't wait - the old CDP session is probably dead anyway
          existingStream.stop().catch(() => {});
        }

        console.info(`[ViewerRegistry] Browser ready for ${viewerKey}, starting screencast...`);
        this.doStartScreencast(viewerKey, toolset, threadId).catch(error => {
          console.error(`[ViewerRegistry] Failed to start screencast on browser ready for ${viewerKey}:`, error);
        });
      }, threadId);
      this.browserReadyCleanups.set(viewerKey, cleanup);
    }

    // Register callback for browser closed (external close detection)
    // This ensures UI shows "browser closed" overlay immediately
    // Pass threadId so callback only fires when that specific thread's browser closes
    if (!this.browserClosedCleanups.has(viewerKey)) {
      const cleanup = toolset.onBrowserClosed(() => {
        console.info(`[ViewerRegistry] Browser closed for ${viewerKey}, notifying viewers...`);
        // Clean up screencast reference (CDP session is dead)
        this.screencasts.delete(viewerKey);
        // Broadcast browser_closed status to UI
        this.broadcastStatus(viewerKey, { status: 'browser_closed' });
      }, threadId);
      this.browserClosedCleanups.set(viewerKey, cleanup);
    }

    // Check if browser is already running
    if (toolset.isBrowserRunning()) {
      // Browser is running, start screencast immediately
      await this.doStartScreencast(viewerKey, toolset, threadId);
    } else {
      // Browser not running - callback will fire when it becomes ready
      console.info(`[ViewerRegistry] Browser not running for ${viewerKey}, waiting for browser to start...`);
    }
  }

  /**
   * Internal method to actually start the screencast stream.
   *
   * @param viewerKey - The viewer key (for registry keying and logging)
   * @param toolset - The browser toolset
   * @param threadId - The thread ID for thread-scoped page selection (optional)
   */
  private async doStartScreencast(
    viewerKey: string,
    toolset: NonNullable<ReturnType<BrowserStreamConfig['getToolset']>>,
    threadId?: string,
  ): Promise<void> {
    // Skip if already streaming or currently starting (prevents race conditions)
    if (this.screencasts.has(viewerKey) || this.startingScreencasts.has(viewerKey)) {
      return;
    }

    // Mark as starting to prevent concurrent starts
    this.startingScreencasts.add(viewerKey);

    try {
      this.broadcastStatus(viewerKey, { status: 'browser_starting' });

      // Use startScreencastIfBrowserActive to avoid launching browser
      // Pass threadId for thread-scoped page selection
      const stream = await toolset.startScreencastIfBrowserActive(threadId ? { threadId } : undefined);
      if (!stream) {
        console.warn(`[ViewerRegistry] No browser session for ${viewerKey}`);
        // Tell the UI this thread has no browser session yet
        // Using 'browser_closed' to indicate no active browser for this thread
        this.broadcastStatus(viewerKey, { status: 'browser_closed' });
        return;
      }

      this.screencasts.set(viewerKey, stream);

      // Capture reference to guard against stale callbacks from superseded streams
      const currentStream = stream;

      // Wire up frame events + viewport tracking
      stream.on('frame', frame => {
        // Ignore frames from superseded streams
        if (this.screencasts.get(viewerKey) !== currentStream) return;
        this.broadcastFrame(viewerKey, frame.data);
        this.broadcastViewportIfChanged(viewerKey, frame.viewport);
      });

      // Wire up URL change events (emitted by browser providers on navigation)
      stream.on('url', (url: string) => {
        // Ignore URL updates from superseded streams
        if (this.screencasts.get(viewerKey) !== currentStream) return;
        this.broadcastUrlIfChanged(viewerKey, url);
      });

      // Wire up stop events
      stream.on('stop', reason => {
        // Ignore stop events from superseded streams (e.g., old stream stopping after reconnect)
        if (this.screencasts.get(viewerKey) !== currentStream) {
          console.info(`[ViewerRegistry] Ignoring stop from superseded stream for ${viewerKey}`);
          return;
        }
        console.info(`[ViewerRegistry] Screencast stopped for ${viewerKey}: ${reason}`);
        this.screencasts.delete(viewerKey);
        this.broadcastStatus(viewerKey, { status: 'browser_closed' });
      });

      // Wire up error events - treat errors as browser closed since screencast can't continue
      stream.on('error', error => {
        // Ignore errors from superseded streams
        if (this.screencasts.get(viewerKey) !== currentStream) return;
        console.error(`[ViewerRegistry] Screencast error for ${viewerKey}:`, error);
        this.screencasts.delete(viewerKey);
        // Explicitly stop the stream to clean up CDP resources
        currentStream.stop().catch(stopError => {
          console.warn(`[ViewerRegistry] Error stopping errored screencast for ${viewerKey}:`, stopError);
        });
        this.broadcastStatus(viewerKey, { status: 'browser_closed' });
      });

      this.broadcastStatus(viewerKey, { status: 'streaming' });

      // Send initial URL - pass threadId to get URL from correct browser session
      const initialUrl = await toolset.getCurrentUrl(threadId);
      this.broadcastUrlIfChanged(viewerKey, initialUrl);
    } catch (error) {
      console.error(`[ViewerRegistry] Failed to start screencast for ${viewerKey}:`, error);
      // Connection stays open - user can see error status
    } finally {
      // Clear starting flag
      this.startingScreencasts.delete(viewerKey);
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
   * @param viewerKey - The viewer key (agentId or agentId:threadId for thread-scoped)
   */
  async closeBrowserSession(viewerKey: string): Promise<void> {
    // NOTE: Do NOT clean up the onBrowserReady callback here.
    // Viewers are still connected (WebSocket stays open), so we need
    // the callback to fire when the browser relaunches from a subsequent
    // tool call. Callback cleanup only happens in removeViewer() when
    // the last viewer disconnects.

    // Clear URL, viewport, and status tracking so next session sends fresh data
    this.lastUrls.delete(viewerKey);
    this.lastViewports.delete(viewerKey);
    this.lastStatuses.delete(viewerKey);

    // Stop screencast if active
    const stream = this.screencasts.get(viewerKey);
    if (stream) {
      try {
        await stream.stop();
        // Note: stream.stop() emits 'stop' event which triggers broadcastStatus
      } catch (error) {
        console.warn(`[ViewerRegistry] Error stopping screencast for ${viewerKey}:`, error);
        // Still broadcast browser_closed even if stop fails
        this.screencasts.delete(viewerKey);
        this.broadcastStatus(viewerKey, { status: 'browser_closed' });
      }
    } else {
      // No active screencast, but still broadcast browser_closed
      this.broadcastStatus(viewerKey, { status: 'browser_closed' });
    }
  }
}
