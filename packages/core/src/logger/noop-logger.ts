import type { IMastraLogger } from './logger';

export const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  cleanup: async () => {},
  getTransports: () => new Map(),
  trackException: () => {},
  listLogs: async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
  listLogsByRunId: async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false }),
} as IMastraLogger;
