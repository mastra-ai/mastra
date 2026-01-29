import type { BrowserToolsetLike } from '@mastra/core/agent';

/**
 * Status message sent to connected viewers.
 * Indicates the current state of the browser stream.
 */
export interface StatusMessage {
  status: 'connected' | 'browser_starting' | 'streaming' | 'browser_closed';
}

/**
 * Error message sent to connected viewers when something goes wrong.
 */
export interface ErrorMessage {
  error: 'browser_crashed' | 'screencast_failed' | 'auth_failed';
  message: string;
}

/**
 * Configuration for the browser stream WebSocket setup.
 */
export interface BrowserStreamConfig {
  /**
   * Function to retrieve the BrowserToolset for a given agent ID.
   * Returns undefined if no browser is available for this agent.
   */
  getToolset: (agentId: string) => BrowserToolsetLike | undefined;
}
