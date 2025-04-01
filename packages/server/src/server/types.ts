import type { Mastra } from '@mastra/core/mastra';

export interface ApiError extends Error {
  message: string;
  status?: number;
}

export interface Context {
  mastra: Mastra;
}
