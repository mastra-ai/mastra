import { describe, expect, it } from 'vitest';

import { workBoardInfo as work } from '../../../../e2e/ui/board-catalog';
import type { WorkItemStarters } from '../../../api/types';
import { starterPrompts } from './starterPrompts';
import type { StarterKind } from './starterPrompts';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

/** What the starters route answers for a board where nothing waits, with `counted` on top. */
function counts(counted: Partial<WorkItemStarters> = {}): WorkItemStarters {
  return {
    failed: 0,
    changesRequested: 0,
    review: { count: 0 },
    undecided: 0,
    untriaged: 0,
    unplannedBugs: 0,
    stale: 0,
    ...counted,
  };
}

function build(counted?: Partial<WorkItemStarters>) {
  return starterPrompts({ board: work, starters: counts(counted), now: NOW });
}

function promptFor(kind: StarterKind, counted: Partial<WorkItemStarters>) {
  const found = build(counted).find(prompt => prompt.kind === kind);
  if (!found) throw new Error(`No ${kind} prompt`);
  return found;
}

const quietBoard: Partial<WorkItemStarters> = {
  review: { count: 1, oldestOpenedAt: daysAgo(2) },
  undecided: 3,
  untriaged: 1,
  unplannedBugs: 1,
  sweep: { area: 'Memory', count: 3 },
  stale: 1,
};
const busyBoard: Partial<WorkItemStarters> = { ...quietBoard, failed: 1, changesRequested: 1 };

describe('starterPrompts', () => {
  it('offers nothing when no card waits on anyone', () => {
    expect(build()).toEqual([]);
  });

  it('offers nothing without the default board', () => {
    expect(starterPrompts({ board: undefined, starters: counts(busyBoard), now: NOW })).toEqual([]);
  });

  it('ranks fresh pull requests, decisions, intake, bugs, the area sweep and stale pull requests', () => {
    expect(build(quietBoard).map(({ kind }) => kind)).toEqual(['review', 'decide', 'triage', 'bug', 'sweep', 'stale']);
  });

  it('puts failed runs and review feedback first and shows six cards at most', () => {
    expect(build(busyBoard).map(({ kind }) => kind)).toEqual([
      'unblock',
      'feedback',
      'review',
      'decide',
      'triage',
      'bug',
    ]);
  });

  it('shows how long the oldest pull request has waited, in whole days, and reviews a batch of the oldest', () => {
    expect(promptFor('review', { review: { count: 2, oldestOpenedAt: daysAgo(10.5) } })).toMatchObject({
      label: 'Longest review wait',
      value: 10,
      unit: 'days',
      action: 'Review the 2 oldest',
    });
    expect(promptFor('review', { review: { count: 1, oldestOpenedAt: daysAgo(1) } })).toMatchObject({
      value: 1,
      unit: 'day',
      action: 'Review it',
    });
    expect(promptFor('review', { review: { count: 9, oldestOpenedAt: daysAgo(29) } }).action).toBe(
      'Review the 5 oldest',
    );
  });

  it('hands stale pull requests to a close-or-keep suggestion', () => {
    expect(promptFor('stale', { stale: 2 })).toMatchObject({
      label: 'Stale pull requests',
      value: 2,
      action: 'Flag what to close',
    });
  });

  it('asks for a decision on the cards triage left for a person', () => {
    expect(promptFor('decide', { undecided: 2 })).toMatchObject({
      label: 'Triaged, waiting for you',
      value: 2,
      action: 'Help me decide',
    });
  });

  it('sweeps the largest area by name', () => {
    expect(promptFor('sweep', { sweep: { area: 'Memory', count: 3 } })).toMatchObject({
      label: 'Memory backlog',
      value: 3,
      action: 'Group by root cause',
    });
  });

  it('offers no sweep for an area with fewer than three open cards', () => {
    const kinds = build({ sweep: { area: 'Memory', count: 2 } }).map(({ kind }) => kind);

    expect(kinds).not.toContain('sweep');
  });

  it('names the phase untriaged cards wait in', () => {
    expect(promptFor('triage', { untriaged: 1 })).toMatchObject({
      label: 'Untriaged in Intake',
      value: 1,
      action: 'Triage it',
    });
  });

  it('counts every card waiting in Intake but triages a batch of five', () => {
    expect(promptFor('triage', { untriaged: 7 })).toMatchObject({ value: 7, action: 'Triage the 5 newest' });
  });

  it('plans one fix, whether one bug or several have no plan', () => {
    expect(promptFor('bug', { unplannedBugs: 1 })).toMatchObject({ label: 'Bugs with no plan', action: 'Plan a fix' });
    expect(promptFor('bug', { unplannedBugs: 2 })).toMatchObject({ value: 2, action: 'Plan a fix for one' });
  });

  it('retries a batch of the failed runs', () => {
    expect(promptFor('unblock', { failed: 1 })).toMatchObject({
      label: 'Failed runs',
      value: 1,
      action: 'Debug and retry it',
    });
    expect(promptFor('unblock', { failed: 8 }).action).toBe('Debug and retry 5');
  });

  it('makes the changes a review asked for', () => {
    expect(promptFor('feedback', { changesRequested: 1 })).toMatchObject({
      label: 'Changes requested',
      value: 1,
      action: 'Make the changes',
    });
  });

  it('speaks of the default board and its rest phase by their own names', () => {
    expect(promptFor('review', quietBoard).prompt).toContain('Intake on the Work board');
    expect(promptFor('stale', quietBoard).prompt).toContain('Intake on the Work board');
  });

  it('sends a prompt that names no area or count, whatever the board holds', () => {
    const prompts = [...build(busyBoard), ...build(quietBoard)];

    expect(new Set(prompts.map(({ kind }) => kind)).size).toBe(8);
    for (const { prompt } of prompts) {
      expect(prompt).not.toContain('Memory');
      expect(prompt).not.toContain('#');
    }
    expect(promptFor('triage', { untriaged: 1 }).prompt).toBe(promptFor('triage', { untriaged: 7 }).prompt);
  });
});
