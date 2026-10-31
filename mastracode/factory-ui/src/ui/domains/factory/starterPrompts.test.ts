import { describe, expect, it } from 'vitest';

import type { WorkItemStarters } from './services/workItems';
import { starterPrompts } from './starterPrompts';
import type { StarterKind } from './starterPrompts';

const NOW = new Date('2026-10-26T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY).toISOString();
}

const NOTHING: WorkItemStarters = {
  failed: 0,
  changesRequested: 0,
  review: { count: 0 },
  undecided: 0,
  untriaged: 0,
  unplannedBugs: 0,
  stale: 0,
};

const QUIET: WorkItemStarters = {
  ...NOTHING,
  review: { count: 1, oldestOpenedAt: daysAgo(2) },
  undecided: 3,
  untriaged: 1,
  unplannedBugs: 1,
  sweep: { area: 'Memory', count: 3 },
  stale: 1,
};

const BUSY: WorkItemStarters = { ...QUIET, failed: 1, changesRequested: 1 };

function build(starters: Partial<WorkItemStarters>) {
  return starterPrompts({ starters: { ...NOTHING, ...starters }, now: NOW });
}

function promptFor(kind: StarterKind, starters: Partial<WorkItemStarters>) {
  const found = build(starters).find(prompt => prompt.kind === kind);
  if (!found) throw new Error(`No ${kind} prompt`);
  return found;
}

describe('starterPrompts', () => {
  it('offers nothing when no card waits on anyone', () => {
    expect(build(NOTHING)).toEqual([]);
  });

  it('ranks fresh pull requests, decisions, intake, bugs, the area sweep and stale pull requests', () => {
    expect(build(QUIET).map(({ kind }) => kind)).toEqual(['review', 'decide', 'triage', 'bug', 'sweep', 'stale']);
  });

  it('puts failed runs and review feedback first and shows six cards at most', () => {
    expect(build(BUSY).map(({ kind }) => kind)).toEqual(['unblock', 'feedback', 'review', 'decide', 'triage', 'bug']);
  });

  it('shows how long the oldest fresh pull request has waited', () => {
    expect(promptFor('review', { review: { count: 2, oldestOpenedAt: daysAgo(10) } })).toMatchObject({
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
  });

  it('names the sweep after its area', () => {
    expect(promptFor('sweep', { sweep: { area: 'Memory', count: 4 } })).toMatchObject({
      label: 'Memory backlog',
      value: 4,
      action: 'Group by root cause',
    });
  });

  it('counts every card waiting but acts on a batch of five', () => {
    expect(promptFor('triage', { untriaged: 7 })).toMatchObject({ value: 7, action: 'Triage the 5 newest' });
    expect(promptFor('triage', { untriaged: 1 })).toMatchObject({ value: 1, action: 'Triage it' });
    expect(promptFor('unblock', { failed: 7 })).toMatchObject({ label: 'Failed runs', action: 'Debug and retry 5' });
    expect(promptFor('bug', { unplannedBugs: 2 })).toMatchObject({ action: 'Plan a fix for one' });
    expect(promptFor('stale', { stale: 2 })).toMatchObject({ value: 2, action: 'Flag what to close' });
    expect(promptFor('decide', { undecided: 2 })).toMatchObject({
      label: 'Not yet accepted',
      action: 'Help me decide',
    });
    expect(promptFor('feedback', { changesRequested: 1 })).toMatchObject({ label: 'Changes requested' });
  });

  it('sends a prompt that names no area, whatever the counts', () => {
    const prompts = [...build(BUSY), ...build(QUIET)];

    expect(new Set(prompts.map(({ kind }) => kind)).size).toBe(8);
    for (const { prompt } of prompts) expect(prompt).not.toContain('Memory');
    expect(promptFor('triage', { untriaged: 1 }).prompt).toBe(promptFor('triage', { untriaged: 7 }).prompt);
  });
});
