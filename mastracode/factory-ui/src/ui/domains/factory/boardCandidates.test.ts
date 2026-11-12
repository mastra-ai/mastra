import { describe, expect, it } from 'vitest';

import type { IncidentioIssue } from './services/incidentio';
import type { JiraIssue } from './services/jira';
import type { LinearIssue } from './services/linear';
import { searchWords } from '@mastra/factory/work-items/search-words';

import { boardFiltersFromParams } from './boardFilters';
import {
  candidateMatchesView,
  incidentioCandidate,
  issueCandidate,
  jiraCandidate,
  linearCandidate,
  pullRequestCandidate,
} from './boardCandidates';
import type { BoardCandidate } from './boardCandidates';

const issue: JiraIssue = {
  id: 'jira-issue:encoded-reference',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  author: 'Grace',
  state: 'In Progress',
  stateType: 'started',
  priorityLabel: 'High',
  assignee: 'Ada',
  project: 'ENG',
  site: 'acme.atlassian.net',
  labels: ['bug', 'backend'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  sourceId: 'jira-project:encoded-source',
};

const followUp: IncidentioIssue = {
  id: 'incidentio:follow-up:01HFOLLOWUP',
  identifier: 'INC-42',
  title: 'Add database failover alert',
  url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
  author: 'Ada Lovelace',
  state: 'outstanding',
  stateType: 'unstarted',
  priorityLabel: 'Urgent',
  assignee: 'Grace Hopper',
  incident: 'incident-1',
  labels: ['reliability'],
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T12:00:00Z',
  sourceId: 'incidentio:follow-ups',
};

describe('incidentioCandidate', () => {
  it('preserves incident.io metadata when the follow-up becomes a work card', () => {
    expect(incidentioCandidate(followUp)).toMatchObject({
      source: 'incidentio-follow-up',
      sourceKey: followUp.id,
      meta: ['INC-42', 'outstanding', 'Grace Hopper'],
      metadata: {
        identifier: 'INC-42',
        issueRef: followUp.id,
        state: 'outstanding',
        stateType: 'unstarted',
        priority: 'Urgent',
        incident: 'incident-1',
        assignee: 'Grace Hopper',
        assignees: ['Grace Hopper'],
        creator: 'Ada Lovelace',
        author: 'Ada Lovelace',
        labels: ['reliability'],
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T12:00:00Z',
      },
    });
  });
});

describe('linearCandidate', () => {
  it('retains the Linear project needed for repository routing when filing an issue', () => {
    const linearIssue: LinearIssue = {
      id: 'linear-issue-1',
      identifier: 'ENG-42',
      title: 'Fix intake sync',
      url: 'https://linear.app/acme/issue/ENG-42',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: null,
      team: 'Engineering',
      sourceId: 'linear-team:engineering',
      projectId: 'linear-project-1',
      labels: [],
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-02T00:00:00Z',
    };

    expect(linearCandidate(linearIssue).metadata).toMatchObject({ linearProjectId: 'linear-project-1' });
  });
});

describe('jiraCandidate', () => {
  it('preserves Jira metadata when the issue becomes a work card', () => {
    expect(jiraCandidate(issue)).toMatchObject({
      source: 'jira-issue',
      sourceKey: issue.id,
      metadata: {
        identifier: 'ENG-42',
        issueRef: issue.id,
        state: 'In Progress',
        stateType: 'started',
        priority: 'High',
        project: 'ENG',
        site: 'acme.atlassian.net',
        assignee: 'Ada',
        assignees: ['Ada'],
        creator: 'Grace',
        author: 'Grace',
        labels: ['bug', 'backend'],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-02T00:00:00Z',
      },
    });
  });
});

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
  const jira = jiraCandidate(issue);
  const incident = incidentioCandidate(followUp);

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
    expect(matches(jira, 'author=jira%3Agrace')).toBe(true);
    expect(matches(jira, 'assignee=jira%3Aada')).toBe(true);
    expect(matches(incident, 'assignee=incidentio%3Agrace%20hopper')).toBe(true);
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
    expect(matches(jira, 'source=github')).toBe(false);
    expect(matches(githubPr, 'source=pull-request')).toBe(true);
    expect(matches(githubIssue, 'source=pull-request')).toBe(false);
  });

  it('finds an issue by every searched word, in its title or its key, whatever their order and case', () => {
    expect(matches(githubIssue, '', 'BUG fix')).toBe(true);
    expect(matches(githubIssue, '', 'fix cache')).toBe(false);
    expect(matches(githubIssue, '', '#7')).toBe(true);
    expect(matches(jira, '', 'eng-42 intake')).toBe(true);
  });
});
