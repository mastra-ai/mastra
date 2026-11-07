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
  browserStream?: boolean;
  /**
   * Set to `false` to never mount the computer viewer proxy.
   *
   * @experimental
   */
  computerStream?: false;
};

export type BodyLimitOptions = {
  maxSize: number;
  onError: (c: Context) => Response;
};
