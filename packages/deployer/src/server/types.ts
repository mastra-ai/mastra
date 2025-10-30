import type { Tool } from '@mastra/core/tools';
import type { Context } from 'hono';

export interface ApiError extends Error {
  message: string;
  status?: number;
}

export type ServerBundleOptions = {
  playground?: boolean;
  isDev?: boolean;
  tools: Record<string, Tool>;
};

export type BodyLimitOptions = {
  maxSize: number;
  onError: (c: Context) => Response;
};
