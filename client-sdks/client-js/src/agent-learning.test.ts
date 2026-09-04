import { describe, expect, it } from 'vitest';

import { enrichedThemeLearningEntity } from './__tests__/fixtures/agent-learning-index';
import type { ThemeLearningEntity } from './agent-learning';

const legacyThemeLearningEntity = {
  entityId: 'legacy-agent',
  entityType: 'agent',
  availableSignals: ['goal'],
} satisfies ThemeLearningEntity;

describe('ThemeLearningEntity', () => {
  it('types enriched entity index metadata', () => {
    expect(enrichedThemeLearningEntity).toMatchObject({
      traceCount: 128,
      readySignalCount: 5,
      enabledSignalCount: 6,
      status: 'processing',
      updatedAt: '2026-08-18T15:00:00.000Z',
    });
  });

  it('keeps index metadata optional for rolling compatibility', () => {
    expect(legacyThemeLearningEntity).toEqual({
      entityId: 'legacy-agent',
      entityType: 'agent',
      availableSignals: ['goal'],
    });
  });
});
