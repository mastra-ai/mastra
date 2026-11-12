import { describe, expect, it } from 'vitest';

import { linearRecord } from '../../__tests__/fixtures/intakeCandidates';
import { intakeCandidate, issueCandidate } from './boardCandidates';
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
    const linear = intakeCandidate(linearRecord('ENG-13', { labels: ['frontend'] }));
    if (!linear) throw new Error('Linear records are offered for filing');

    expect(boardLabels({ labels: ['p1', 'bug'], candidates: [github, linear] })).toEqual([
      'bug',
      'frontend',
      'p1',
      'ux',
    ]);
  });
});
