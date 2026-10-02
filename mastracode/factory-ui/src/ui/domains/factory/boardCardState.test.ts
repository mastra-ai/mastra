import { describe, expect, it } from 'vitest';

import type { InstalledPhaseInfo } from '../../../api/types';
import { boardCardState, canMoveTo, itemAwaitsPerson } from './boardCardState';
import type { BoardCardOwner, BoardCardStateInput } from './boardCardState';
import { cardActions } from './cardPrimaryAction';
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

describe('status row', () => {
  it('announces the move the user just asked for over anything the server is doing', () => {
    expect(
      boardCardState({
        moving: { stage: 'planning', label: 'Planning' },
        decision: decision({ status: 'failed', lastError: 'ENOENT' }),
      }).status,
    ).toEqual({ kind: 'busy', label: 'Moving to Planning…' });
  });

  it('keeps the click that is still resolving ahead of a rule effect queued behind it', () => {
    expect(boardCardState({ preparing: 'Preparing run…', decision: decision({ status: 'pending' }) }).status).toEqual({
      kind: 'busy',
      label: 'Preparing run…',
    });
  });

  it('offers the retry and hides the raw failure behind the detail', () => {
    expect(
      boardCardState({ decision: decision({ status: 'failed', lastError: 'ENOENT: no such file' }) }).status,
    ).toEqual({
      kind: 'error',
      label: 'Automated run could not start',
      detail: 'ENOENT: no such file',
      retryDecisionId: 'decision-1',
    });
  });

  it('does not offer Retry for a deterministic failure', () => {
    expect(
      boardCardState({
        decision: decision({
          status: 'failed',
          failureCode: 'unsupported_provider_item',
          canRetry: false,
          lastError: 'Factory skill invocation requires a supported provider item.',
        }),
      }).status,
    ).toEqual({
      kind: 'error',
      label: 'Automated run could not start',
      detail: 'Factory skill invocation requires a supported provider item.',
    });
  });

  it('separates an effect the server is retrying from one it has not tried yet', () => {
    expect(boardCardState({ decision: decision({ status: 'retry', lastError: 'ECONNRESET' }) }).status).toEqual({
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
      boardCardState({
        decision: decision({
          type: 'upsertLinkedWorkItem',
          source: 'github-pr',
          status: 'retry',
          attempts: 0,
          lastError: null,
        }),
      }).status,
    ).toEqual({ kind: 'busy', label: 'Syncing GitHub pull request…' });
  });

  it('names the system a linked card is synced with', () => {
    const sync = (source: FactoryDecisionSummary['source']) =>
      boardCardState({ decision: decision({ type: 'upsertLinkedWorkItem', source, status: 'pending', attempts: 0 }) })
        .status;
    expect(sync('github-issue')).toEqual({ kind: 'busy', label: 'Syncing GitHub issue…' });
    expect(sync('gitlab-issue')).toEqual({ kind: 'busy', label: 'Syncing GitLab issue…' });
    expect(sync('gitlab-pr')).toEqual({ kind: 'busy', label: 'Syncing GitLab merge request…' });
    expect(sync('linear-issue')).toEqual({ kind: 'busy', label: 'Syncing Linear issue…' });
  });

  it('still reports an effect that has actually been tried and failed', () => {
    expect(
      boardCardState({
        decision: decision({
          type: 'upsertLinkedWorkItem',
          source: 'github-issue',
          status: 'retry',
          attempts: 2,
          lastError: null,
        }),
      }).status,
    ).toEqual({ kind: 'error', label: "Couldn't sync GitHub issue — retrying…", detail: undefined });
  });

  it('says a run is starting until the registry or the workspace record shows its session', () => {
    expect(boardCardState({ decision: decision({ status: 'pending', attempts: 0 }) }).status).toEqual({
      kind: 'busy',
      label: 'Starting an automated run…',
    });
    expect(boardCardState({ decision: decision({ status: 'leased' }) }).status).toEqual({
      kind: 'busy',
      label: 'Starting an automated run…',
    });
  });

  it('leaves a leased run to the wick once its session is live', () => {
    expect(boardCardState({ decision: decision({ status: 'leased' }), sessionStatus: 'working' }).status).toEqual({
      kind: 'idle',
    });
    expect(boardCardState({ decision: decision({ status: 'leased' }), sessionStatus: 'initializing' }).status).toEqual({
      kind: 'idle',
    });
    expect(
      boardCardState({ decision: decision({ type: 'transition', status: 'leased' }), sessionStatus: 'working' }).status,
    ).toEqual({ kind: 'busy', label: 'Moving this card automatically…' });
  });

  it('describes a queued rule effect in terms of what it does, not the queue', () => {
    expect(boardCardState({ decision: decision({ type: 'transition', status: 'pending' }) }).status).toEqual({
      kind: 'busy',
      label: 'Moving this card automatically…',
    });
  });

  it('asks for the parked run once nothing is moving on its own', () => {
    expect(
      boardCardState({
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
      }).status,
    ).toEqual({ kind: 'waiting', label: 'Re-review', decisionId: 'decision-9' });
  });

  it('lets active work outrank the parked run', () => {
    expect(
      boardCardState({
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
        decision: decision({ type: 'transition', status: 'pending' }),
      }).status,
    ).toEqual({ kind: 'busy', label: 'Moving this card automatically…' });
    expect(
      boardCardState({
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
        sessionStatus: 'working',
      }).status,
    ).toEqual({ kind: 'idle' });
    expect(
      boardCardState({
        proposal: { label: 'Re-review', decisionId: 'decision-9' },
        sessionStatus: 'initializing',
      }).status,
    ).toEqual({ kind: 'idle' });
  });

  it('names the held classification so the card says why it waits on a person', () => {
    expect(boardCardState({ heldAs: 'feature request' }).status).toEqual({
      kind: 'held',
      label: 'Feature request · needs your approval',
    });
    // A suggested run cannot start until the card is accepted, so the hold is the live question.
    expect(
      boardCardState({ heldAs: 'feature request', proposal: { label: 'Build', decisionId: 'decision-9' } }).status,
    ).toEqual({ kind: 'held', label: 'Feature request · needs your approval' });
    // Anything the server is doing outranks the standing hold.
    expect(boardCardState({ heldAs: 'feature request', preparing: 'Starting…' }).status).toEqual({
      kind: 'busy',
      label: 'Starting…',
    });
  });

  it('falls back to idle when nothing is in flight', () => {
    expect(boardCardState({}).status).toEqual({ kind: 'idle' });
  });
});

describe('what a card shows', () => {
  const run = { label: 'Review', start: () => {} };
  const session = { label: 'Open session', href: '/session' };
  const retry = { label: 'Retry', start: () => {} };

  interface ShownCard {
    row?: string;
    wick?: BoardCardStateInput['sessionStatus'];
    buttons: string[];
  }

  function shown(input: BoardCardStateInput): ShownCard {
    const state = boardCardState(input);
    const retryOffered = state.status.kind === 'error' && state.status.retryDecisionId !== undefined;
    const actions = cardActions({
      state,
      session: input.sessionStatus === undefined ? undefined : session,
      retry: retryOffered ? retry : undefined,
      run,
    });
    return {
      row: state.status.kind === 'idle' ? undefined : state.status.label,
      wick: state.wick,
      buttons: actions.map(action => (action.disabled ? `${action.label} (disabled)` : action.label)),
    };
  }

  it.each<[string, BoardCardStateInput, ShownCard]>([
    ['an idle card', {}, { row: undefined, wick: undefined, buttons: ['Review'] }],
    [
      'your move',
      { moving: { stage: 'review', label: 'Reviewing' } },
      { row: 'Moving to Reviewing…', wick: undefined, buttons: ['Moving… (disabled)'] },
    ],
    [
      'your move on a card with a live session',
      { moving: { stage: 'review', label: 'Reviewing' }, sessionStatus: 'working' },
      { row: 'Moving to Reviewing…', wick: 'working', buttons: ['Open session'] },
    ],
    [
      'your retry before the failure refreshes',
      { decision: decision({ status: 'failed' }), retryRequested: true },
      { row: 'Retrying…', wick: undefined, buttons: ['Retrying… (disabled)'] },
    ],
    [
      'a queued run',
      { decision: decision({ status: 'pending' }) },
      { row: 'Starting an automated run…', wick: undefined, buttons: ['Starting… (disabled)'] },
    ],
    [
      'a queued automatic move',
      { decision: decision({ type: 'transition', status: 'pending' }) },
      { row: 'Moving this card automatically…', wick: undefined, buttons: ['Moving… (disabled)'] },
    ],
    [
      'a linked-card replay',
      { decision: decision({ type: 'upsertLinkedWorkItem', source: 'github-pr', status: 'retry', attempts: 0 }) },
      { row: 'Syncing GitHub pull request…', wick: undefined, buttons: ['Syncing… (disabled)'] },
    ],
    [
      'an automatic retry',
      { decision: decision({ status: 'retry', lastError: 'Timeout' }) },
      { row: 'Automated run could not start — retrying…', wick: undefined, buttons: ['Retrying… (disabled)'] },
    ],
    [
      'a refused move while a run is queued',
      { transitionReason: 'Move rejected', decision: decision({ status: 'pending' }) },
      { row: 'Move rejected', wick: undefined, buttons: ['Starting… (disabled)'] },
    ],
    [
      'a final failure',
      { decision: decision({ status: 'failed' }) },
      { row: 'Automated run could not start', wick: undefined, buttons: ['Retry', 'Review'] },
    ],
    [
      'a live run',
      { decision: decision({ status: 'leased' }), sessionStatus: 'working' },
      { row: undefined, wick: 'working', buttons: ['Open session'] },
    ],
    [
      'a parked session with a run queued behind it',
      { decision: decision({ status: 'pending' }), sessionStatus: 'ready' },
      { row: 'Starting an automated run…', wick: 'ready', buttons: ['Open session'] },
    ],
  ])('%s', (_, input, expected) => {
    expect(shown(input)).toEqual(expected);
  });
});

describe('canMoveTo', () => {
  const parkedSession: BoardCardOwner = { kind: 'session', status: 'ready' };
  const retrying: BoardCardOwner = { kind: 'automation', progressLabel: 'Retrying…' };
  const yourMove: BoardCardOwner = { kind: 'you', progressLabel: 'Moving…' };

  it.each<[string, BoardCardOwner, InstalledPhaseInfo['kind'] | undefined, boolean]>([
    ['a free card', { kind: 'free' }, undefined, true],
    ['a parked session', parkedSession, 'terminal', true],
    ['a parked session', parkedSession, 'resting', true],
    ['a parked session', parkedSession, 'working', false],
    ['a parked session', parkedSession, undefined, false],
    ['an automatic retry', retrying, 'terminal', true],
    ['an automatic retry', retrying, 'working', false],
    ['your own move', yourMove, 'terminal', false],
  ])('%s into a %s phase: %s', (_, owner, phaseKind, allowed) => {
    expect(canMoveTo(owner, phaseKind)).toBe(allowed);
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
