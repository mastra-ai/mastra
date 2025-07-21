import type { Context } from 'hono';

export interface ApiError extends Error {
  message: string;
  status?: number;
}

export type ServerBundleOptions = {
  playground?: boolean;
  isDev?: boolean;
};

export type BodyLimitOptions = {
  maxSize: number;
  onError: (c: Context) => Response;
};
