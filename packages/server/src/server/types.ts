import type { Container } from '@mastra/core/di';
import type { Mastra } from '@mastra/core/mastra';
export interface ApiError extends Error {
  message: string;
  status?: number;
}

export interface Context {
  mastra: Mastra;
  container?: Container;
}
