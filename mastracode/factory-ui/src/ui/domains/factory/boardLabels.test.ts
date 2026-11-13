import { describe, expect, it } from 'vitest';

import { issueCandidate, linearCandidate } from './boardCandidates';
import { boardLabels } from './boardLabels';

describe('board labels', () => {
  it("offers the labels of the project's cards and of issues not filed yet, each once, in alphabetical order", () => {
    const github = issueCandidate({
      number: 8,
      title: 'Fix cache',
      url: 'https://github.com/acme/app/issues/8',
      author: 'hubot',
      assignee: null,
      labels: ['ux', 'p1'],
      comments: 0,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    const linear = linearCandidate({
      id: 'linear-2',
      identifier: 'ENG-13',
      title: 'Linear labels',
      url: 'https://linear.app/acme/issue/ENG-13',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: null,
      creator: null,
      team: 'Engineering',
      labels: ['frontend'],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    expect(boardLabels({ labels: ['p1', 'bug'], candidates: [github, linear] })).toEqual([
      'bug',
      'frontend',
      'p1',
      'ux',
    ]);
  });
});
