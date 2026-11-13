import { describe, expect, it } from 'vitest';

import { gitlabCandidate, issueCandidate } from './boardCandidates';
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
    const gitlab = gitlabCandidate({
      id: 'gitlab-issue-13',
      externalId: 'gitlab:acme/app#13',
      identifier: 'acme/app#13',
      title: 'GitLab labels',
      url: 'https://gitlab.com/acme/app/-/issues/13',
      state: 'opened',
      stateType: 'unstarted',
      priority: null,
      assignee: null,
      author: null,
      source: 'acme/app',
      sourceId: 'gitlab-project:1',
      labels: ['frontend'],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    expect(boardLabels({ labels: ['p1', 'bug'], candidates: [github, gitlab] })).toEqual([
      'bug',
      'frontend',
      'p1',
      'ux',
    ]);
  });
});
