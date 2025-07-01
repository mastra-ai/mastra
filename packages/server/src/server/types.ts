import type { MastraError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';

export interface ApiError extends MastraError {
  message: string;
  status?: number;
}

export interface Context {
  mastra: Mastra;
}
