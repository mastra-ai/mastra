import type { ThemeLearningEntity } from '../../agent-learning';

export const enrichedThemeLearningEntity = {
  entityId: 'support-agent',
  entityType: 'agent',
  availableSignals: ['goal', 'outcome', 'tool_usage'],
  traceCount: 128,
  readySignalCount: 5,
  enabledSignalCount: 6,
  status: 'processing',
  updatedAt: '2026-08-18T15:00:00.000Z',
} satisfies ThemeLearningEntity;
