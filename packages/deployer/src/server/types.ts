import type { BrowserToolset } from '@mastra/agent-browser';
import type { Tool } from '@mastra/core/tools';
import type { Context } from 'hono';

export interface ApiError extends Error {
  message: string;
  status?: number;
}

export type ServerBundleOptions = {
  studio?: boolean;
  isDev?: boolean;
  tools: Record<string, Tool>;
  /**
   * Map of agentId to BrowserToolset for browser stream support.
   * When provided, enables WebSocket streaming at /browser/:agentId/stream.
   * This allows Studio viewers to watch browser agents work in real-time.
   */
  browserToolsets?: Map<string, BrowserToolset>;
};

export type BodyLimitOptions = {
  maxSize: number;
  onError: (c: Context) => Response;
};
