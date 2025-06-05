import type { IMastraLogger } from './logger';

export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: async () => {},
  getTransports: () => new Map(),
  getLogs: async () => ({ logs: [], total: 0, page: 0, perPage: 0, hasMore: false }),
  getLogsByRunId: async () => ({ logs: [], total: 0, page: 0, perPage: 0, hasMore: false }),
} as IMastraLogger;
