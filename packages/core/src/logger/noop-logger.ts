import type { IMastraLogger } from './logger';

export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: async () => {},
  getTransports: () => new Map(),
  getLogs: async () => [],
  getLogsByRunId: async () => [],
} as IMastraLogger;
