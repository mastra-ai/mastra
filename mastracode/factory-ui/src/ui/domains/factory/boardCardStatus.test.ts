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
    role: null,
    status: 'leased',
    attempts: 1,
    failureOccurrence: 0,
    failureCode: null,
    canRetry: true,
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

  it('keeps the click that is still resolving ahead of a rule effect queued behind it', () => {
    expect(
      boardCardStatus({ idle: IDLE, preparing: 'Preparing run…', decision: decision({ status: 'pending' }) }),
    ).toEqual({ kind: 'busy', label: 'Preparing run…' });
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

  it('does not offer Retry for a deterministic failure', () => {
    expect(
      boardCardStatus({
        idle: IDLE,
        decision: decision({
          status: 'failed',
          failureCode: 'unsupported_provider_item',
          canRetry: false,
          lastError: 'Factory skill invocation requires a supported provider item.',
        }),
      }),
    ).toEqual({
      kind: 'error',
      label: 'Automated run could not start',
      detail: 'Factory skill invocation requires a supported provider item.',
    });
  });

  it('separates an effect the server is retrying from one it has not tried yet', () => {
    expect(boardCardStatus({ idle: IDLE, decision: decision({ status: 'retry', lastError: 'ECONNRESET' }) })).toEqual({
      kind: 'error',
      label: 'Automated run could not start — retrying…',
      detail: 'ECONNRESET',
    });
  });

  it('does not call a replayed linked-card effect a failure', () => {
    // A linked-card decision that already succeeded is reset to `retry` when its
    // card is rematerialized, so the card gets re-filed. Nothing failed: no
    // attempt was spent and no error was left. Calling that an error is how the
    // board ends up showing failures nobody caused.
    expect(
      boardCardStatus({
        idle: IDLE,
        decision: decision({ type: 'upsertLinkedWorkItem', status: 'retry', attempts: 0, lastError: null }),
      }),
    ).toEqual({ kind: 'busy', label: 'Filing a linked card…' });
  });

  it('still reports an effect that has actually been tried and failed', () => {
    expect(
      boardCardStatus({
        idle: IDLE,
        decision: decision({ type: 'upsertLinkedWorkItem', status: 'retry', attempts: 2, lastError: null }),
      }),
    ).toEqual({ kind: 'error', label: 'Linked card could not be filed — retrying…', detail: undefined });
  });

  it('describes a queued rule effect in terms of what it does, not the queue', () => {
    expect(boardCardStatus({ idle: IDLE, decision: decision({ type: 'transition', status: 'pending' }) })).toEqual({
      kind: 'busy',
      label: 'Moving this card automatically…',
    });
  });

  it('asks for the parked run once nothing is moving on its own', () => {
    expect(
      boardCardStatus({
        idle: { label: 'Open session', affordance: 'open' },
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
      }),
    ).toEqual({ kind: 'waiting', label: 'Re-review', decisionId: 'decision-9' });
  });

  it('lets an effect the server is already working through outrank the parked run', () => {
    expect(
      boardCardStatus({
        idle: IDLE,
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
        decision: decision({ type: 'transition', status: 'pending' }),
      }),
    ).toEqual({ kind: 'busy', label: 'Moving this card automatically…' });
  });

  it('falls back to the click affordance when nothing is in flight', () => {
    expect(boardCardStatus({ idle: { label: 'Open session', affordance: 'open' } })).toEqual({
      kind: 'idle',
      label: 'Open session',
      affordance: 'open',
    });
  });
});
