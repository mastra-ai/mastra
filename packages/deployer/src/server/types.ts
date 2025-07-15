import type { Tool } from '@mastra/core';

export interface ApiError extends Error {
  message: string;
  status?: number;
}

export type ServerBundleOptions = {
  playground?: boolean;
  isDev?: boolean;
  tools: Record<string, Tool>;
};
