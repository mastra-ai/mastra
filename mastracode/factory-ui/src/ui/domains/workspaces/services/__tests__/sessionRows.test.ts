import { describe, expect, it } from 'vitest';

import { releaseBoard } from '../../../../../../e2e/ui/board-catalog';
import { sessionActivityStatus, sessionBoard } from '../sessionRows';
import { factoryRow, testSession, testWorkItem, userRow } from './fixtures/sessionRows';

describe('sessionBoard', () => {
  it('puts a pull request item from before boards existed on the review board', () => {
    const item = testWorkItem({ board: null, source: 'github-pr' });

    expect(sessionBoard(testSession('s1', { branch: 'factory/issue-3' }), item)).toBe('review');
  });

  it("follows the item's custom board, not the branch", () => {
    const item = testWorkItem({ board: 'release' });

    expect(sessionBoard(testSession('s1', { branch: 'factory/pr-12' }), item)).toBe('release');
  });

  it('reads the branch only when no item is linked', () => {
    expect(sessionBoard(testSession('s1', { branch: 'factory/pr-12' }), undefined)).toBe('review');
    expect(sessionBoard(testSession('s1', { branch: 'factory/issue-3' }), undefined)).toBe('work');
  });
});

describe('sessionActivityStatus', () => {
  const quiet = { initializing: false, running: false, attention: false, settled: false };

  it.each([
    [{ ...quiet, initializing: true, attention: true }, 'initializing'],
    [{ ...quiet, running: true, settled: true }, 'working'],
    [{ ...quiet, attention: true, settled: true }, 'waiting'],
    [{ ...quiet, settled: true }, 'done'],
    [quiet, 'idle'],
  ] as const)('reads %o as %s', (row, status) => {
    expect(sessionActivityStatus(row)).toBe(status);
  });
});

describe('factory session status on a custom board', () => {
  it.each([
    ['shipped', 'done'],
    ['shipping', 'idle'],
  ] as const)('reads a quiet session in the %s phase as %s', (phase, status) => {
    const item = testWorkItem({ board: releaseBoard.id, stages: [phase] });

    expect(factoryRow(testSession('s1'), { item, boards: [releaseBoard] }).status).toBe(status);
  });
});

describe('title regeneration', () => {
  const slackSession = testSession('s1', { branch: 'slack/1791936483-798759' });

  it.each([
    ['an owned user session', true, userRow('s1')],
    ['an owned Slack session', true, factoryRow(slackSession)],
    ['an owned work session', false, factoryRow(testSession('s1'))],
    ["another owner's Slack session", false, factoryRow(slackSession, { viewer: { userId: 'user-2' } })],
  ] as const)('is offered for %s: %s', (_case, offered, row) => {
    expect(row.canRegenerateTitle).toBe(offered);
  });
});
