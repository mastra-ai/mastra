import { describe, expect, it } from 'vitest';

import { boardCardStatus } from './boardCardStatus';
import type { FactoryDecisionSummary } from './services/decisions';

const IDLE = { label: 'Review', affordance: 'run' } as const;

function decision(overrides: Partial<FactoryDecisionSummary> = {}): FactoryDecisionSummary {
  return {
    id: 'decision-1',
    evaluationId: 'evaluation-1',
    workItemId: 'item-1',
    type: 'invokeSkill',
    status: 'leased',
    attempts: 1,
    lastError: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

describe('boardCardStatus', () => {
  it('announces the move the user just asked for over anything the server is doing', () => {
    expect(
      boardCardStatus({
        idle: IDLE,
        moving: { stage: 'planning', label: 'Planning' },
        decision: decision({ status: 'failed', lastError: 'ENOENT' }),
      }),
    ).toEqual({ kind: 'busy', label: 'Moving to Planning…' });
  });

  it('keeps the started run visible while a rule effect fails in the background', () => {
    expect(
      boardCardStatus({
        idle: IDLE,
        runs: [{ label: 'Review', phase: 'workspace' }],
        decision: decision({ status: 'failed' }),
      }),
    ).toEqual({ kind: 'busy', label: 'Review — preparing workspace…' });
  });

  it('offers the retry and hides the raw failure behind the detail', () => {
    expect(
      boardCardStatus({ idle: IDLE, decision: decision({ status: 'failed', lastError: 'ENOENT: no such file' }) }),
    ).toEqual({
      kind: 'error',
      label: 'Automated run could not start',
      detail: 'ENOENT: no such file',
      retryDecisionId: 'decision-1',
    });
  });

  it('describes a queued rule effect in terms of what it does, not the queue', () => {
    expect(boardCardStatus({ idle: IDLE, decision: decision({ type: 'transition', status: 'pending' }) })).toEqual({
      kind: 'busy',
      label: 'Moving this card automatically…',
    });
  });

  it('falls back to the click affordance when nothing is in flight', () => {
    expect(boardCardStatus({ idle: { label: 'Open session', affordance: 'open' } })).toEqual({
      kind: 'idle',
      label: 'Open session',
      affordance: 'open',
    });
  });
});
