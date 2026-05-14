import type { SessionRecord } from '@mastra/core/storage';

/**
 * Builds a SessionRecord with sensible defaults so each test only specifies
 * the fields it cares about. Callers override via `overrides`.
 */
export function createSampleSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = Date.now();
  return {
    id: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    ownsThread: false,
    modeId: 'build',
    modelId: 'claude-opus-4-7',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    pendingQueue: [],
    state: {},
    createdAt: now,
    lastActivityAt: now,
    version: 0,
    ...overrides,
  };
}
