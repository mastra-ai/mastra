import { describe, expect, it } from 'vitest';

import { boardCardStatus, itemAwaitsPerson } from './boardCardStatus';
import type { FactoryDecisionSummary } from './services/decisions';

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
    source: null,
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
        moving: { stage: 'planning', label: 'Planning' },
        decision: decision({ status: 'failed', lastError: 'ENOENT' }),
      }),
    ).toEqual({ kind: 'busy', label: 'Moving to Planning…' });
  });

  it('keeps the started run visible while a rule effect fails in the background', () => {
    expect(
      boardCardStatus({
        runs: [{ label: 'Review', phase: 'workspace' }],
        decision: decision({ status: 'failed' }),
      }),
    ).toEqual({ kind: 'busy', label: 'Review — preparing workspace…' });
  });

  it('keeps the click that is still resolving ahead of a rule effect queued behind it', () => {
    expect(boardCardStatus({ preparing: 'Preparing run…', decision: decision({ status: 'pending' }) })).toEqual({
      kind: 'busy',
      label: 'Preparing run…',
    });
  });

  it('offers the retry and hides the raw failure behind the detail', () => {
    expect(boardCardStatus({ decision: decision({ status: 'failed', lastError: 'ENOENT: no such file' }) })).toEqual({
      kind: 'error',
      label: 'Automated run could not start',
      detail: 'ENOENT: no such file',
      retryDecisionId: 'decision-1',
    });
  });

  it('does not offer Retry for a deterministic failure', () => {
    expect(
      boardCardStatus({
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
    expect(boardCardStatus({ decision: decision({ status: 'retry', lastError: 'ECONNRESET' }) })).toEqual({
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
        decision: decision({
          type: 'upsertLinkedWorkItem',
          source: 'github-pr',
          status: 'retry',
          attempts: 0,
          lastError: null,
        }),
      }),
    ).toEqual({ kind: 'busy', label: 'Syncing GitHub pull request…' });
  });

  it('names the system a linked card is synced with', () => {
    const sync = (source: FactoryDecisionSummary['source']) =>
      boardCardStatus({ decision: decision({ type: 'upsertLinkedWorkItem', source, status: 'pending', attempts: 0 }) });
    expect(sync('github-issue')).toEqual({ kind: 'busy', label: 'Syncing GitHub issue…' });
    expect(sync('linear-issue')).toEqual({ kind: 'busy', label: 'Syncing Linear issue…' });
  });

  it('still reports an effect that has actually been tried and failed', () => {
    expect(
      boardCardStatus({
        decision: decision({
          type: 'upsertLinkedWorkItem',
          source: 'github-issue',
          status: 'retry',
          attempts: 2,
          lastError: null,
        }),
      }),
    ).toEqual({ kind: 'error', label: "Couldn't sync GitHub issue — retrying…", detail: undefined });
  });

  it('tells a run that is underway apart from one still waiting to start', () => {
    expect(boardCardStatus({ decision: decision({ status: 'pending', attempts: 0 }) })).toEqual({
      kind: 'busy',
      label: 'Starting an automated run…',
    });
    expect(boardCardStatus({ decision: decision({ status: 'leased' }), sessionStatus: 'working' })).toEqual({
      kind: 'busy',
      label: 'Automated run in progress…',
    });
  });

  it('claims a run is in progress only while the run registry agrees', () => {
    expect(boardCardStatus({ decision: decision({ status: 'leased' }), sessionStatus: 'initializing' })).toEqual({
      kind: 'busy',
      label: 'Preparing workspace…',
    });
    expect(boardCardStatus({ decision: decision({ status: 'leased' }) })).toEqual({
      kind: 'busy',
      label: 'Starting an automated run…',
    });
    expect(boardCardStatus({ decision: decision({ status: 'leased' }), sessionStatus: 'ready' })).toEqual({
      kind: 'busy',
      label: 'Starting an automated run…',
    });
  });

  it('describes a queued rule effect in terms of what it does, not the queue', () => {
    expect(boardCardStatus({ decision: decision({ type: 'transition', status: 'pending' }) })).toEqual({
      kind: 'busy',
      label: 'Moving this card automatically…',
    });
  });

  it('asks for the parked run once nothing is moving on its own', () => {
    expect(
      boardCardStatus({
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
      }),
    ).toEqual({ kind: 'waiting', label: 'Re-review', decisionId: 'decision-9' });
  });

  it('lets an effect the server is already working through outrank the parked run', () => {
    expect(
      boardCardStatus({
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
        decision: decision({ type: 'transition', status: 'pending' }),
      }),
    ).toEqual({ kind: 'busy', label: 'Moving this card automatically…' });
  });

  it('falls back to idle when nothing is in flight', () => {
    expect(boardCardStatus({})).toEqual({ kind: 'idle' });
  });
});

describe('itemAwaitsPerson', () => {
  it('marks a parked run and an effect that failed for good, never a retry the server still owns', () => {
    expect(itemAwaitsPerson(decision({ status: 'proposed' }), undefined)).toBe(true);
    expect(itemAwaitsPerson(undefined, decision({ status: 'failed' }))).toBe(true);
    expect(itemAwaitsPerson(undefined, decision({ status: 'retry' }))).toBe(false);
  });

  it('stays quiet while an effect the card calls busy runs over the parked run', () => {
    expect(itemAwaitsPerson(decision({ status: 'proposed' }), decision({ status: 'leased' }))).toBe(false);
  });
});
