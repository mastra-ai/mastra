import { describe, expect, it } from 'vitest';

import type { GitLabIssue } from './services/gitlab';
import { searchWords } from '@mastra/factory/work-items/search-words';

import { boardFiltersFromParams } from './boardFilters';
import { candidateMatchesView, gitlabCandidate, issueCandidate, pullRequestCandidate } from './boardCandidates';
import type { BoardCandidate } from './boardCandidates';

const gitlabIssue: GitLabIssue = {
  id: 'gitlab-issue-42',
  externalId: 'gitlab:acme/app#42',
  identifier: 'acme/app#42',
  title: 'Fix intake sync',
  url: 'https://gitlab.com/acme/app/-/issues/42',
  state: 'opened',
  stateType: 'unstarted',
  priority: null,
  assignee: 'ada',
  assignees: ['ada'],
  author: 'grace',
  source: 'acme/app',
  sourceId: 'gitlab-project:1',
  labels: ['bug', 'backend'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
};

describe('candidateMatchesView', () => {
  const githubIssue = issueCandidate({
    number: 7,
    title: 'Fix login bug',
    url: 'https://github.com/acme/app/issues/7',
    author: 'octocat',
    assignee: 'hubot',
    assignees: ['hubot', 'monalisa'],
    labels: ['bug', 'p1'],
    comments: 0,
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  });
  const githubPr = pullRequestCandidate({
    number: 12,
    title: 'Ship relevance filters',
    url: 'https://github.com/acme/app/pull/12',
    author: 'octocat',
    assignees: ['hubot'],
    requestedReviewers: ['monalisa'],
    baseBranch: 'main',
    headBranch: 'feat/relevance',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  });
  const gitlab = gitlabCandidate(gitlabIssue);

  const matches = (candidate: BoardCandidate, query: string, search = '') =>
    candidateMatchesView(candidate, boardFiltersFromParams(new URLSearchParams(query), true), searchWords(search));

  it('keeps every issue when the view picks nothing and searches nothing', () => {
    expect(matches(githubIssue, '')).toBe(true);
  });

  it('matches each person filter only through its own role, and Involves through any', () => {
    expect(matches(githubIssue, 'assignee=github%3Ahubot')).toBe(true);
    expect(matches(githubIssue, 'assignee=github%3Amonalisa')).toBe(true);
    expect(matches(githubIssue, 'author=github%3Ahubot')).toBe(false);
    expect(matches(githubIssue, 'teammate=github%3Ahubot')).toBe(true);
    expect(matches(githubPr, 'reviewer=github%3Amonalisa')).toBe(true);
    expect(matches(githubPr, 'reviewer=github%3Ahubot')).toBe(false);
    expect(matches(gitlab, 'author=gitlab%3Agrace')).toBe(true);
    expect(matches(gitlab, 'assignee=gitlab%3Aada')).toBe(true);
  });

  it('never matches Worked on: nobody has worked on an issue that is not filed', () => {
    expect(matches(githubIssue, 'worked=github%3Aoctocat')).toBe(false);
  });

  it('matches the signed-in user by any id the stored filter names them with', () => {
    expect(matches(githubIssue, 'author=factory%3Auser-octo&author=github%3Aoctocat')).toBe(true);
    expect(matches(githubIssue, 'author=factory%3Auser-octo')).toBe(false);
  });

  it('requires every picked label', () => {
    expect(matches(githubIssue, 'label=bug&label=p1')).toBe(true);
    expect(matches(githubIssue, 'label=bug&label=missing')).toBe(false);
  });

  it('narrows by provider, and lists pull requests under their own source', () => {
    expect(matches(githubIssue, 'source=github')).toBe(true);
    expect(matches(gitlab, 'source=github')).toBe(false);
    expect(matches(githubPr, 'source=pull-request')).toBe(true);
    expect(matches(githubIssue, 'source=pull-request')).toBe(false);
  });

  it('finds an issue by every searched word, in its title or its key, whatever their order and case', () => {
    expect(matches(githubIssue, '', 'BUG fix')).toBe(true);
    expect(matches(githubIssue, '', 'fix cache')).toBe(false);
    expect(matches(githubIssue, '', '#7')).toBe(true);
    expect(matches(gitlab, '', 'acme/app#42 intake')).toBe(true);
  });
});
