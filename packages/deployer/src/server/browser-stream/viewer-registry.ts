import type { ScreencastStream } from '@mastra/agent-browser';
import type { WSContext } from 'hono/ws';

import type { StatusMessage, BrowserStreamConfig } from './types.js';

/**
 * ViewerRegistry manages WebSocket connections per agent and controls screencast lifecycle.
 *
 * Key responsibilities:
 * - Track connected viewers per agentId
 * - Start screencast when first viewer connects
 * - Stop screencast when last viewer disconnects
 * - Broadcast frames to all viewers for an agent
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
  private screencasts = new Map<string, ScreencastStream>();

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

    // Stop screencast if no more viewers
    if (viewerSet.size === 0) {
      this.viewers.delete(agentId);
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
   * Start screencast for an agent. Called when first viewer connects.
   */
  private async startScreencast(agentId: string, getToolset: BrowserStreamConfig['getToolset']): Promise<void> {
    const toolset = getToolset(agentId);
    if (!toolset) {
      // No browser available for this agent - just keep connection open
      // Future: could implement notification when toolset becomes available
      console.info(`[ViewerRegistry] No toolset for agent ${agentId}, waiting...`);
      return;
    }

    try {
      this.broadcastStatus(agentId, { status: 'browser_starting' });

      const stream = await toolset.startScreencast();
      this.screencasts.set(agentId, stream);

      // Wire up frame events
      stream.on('frame', frame => {
        this.broadcastFrame(agentId, frame.data);
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
}
