import { describe, expect, it } from 'vitest';

import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { searchWords } from '@mastra/factory/work-items/search-words';

import type { IntakeCandidateInfo } from '../../../api/types';
import {
  githubIssueRecord,
  githubPullRequestRecord,
  gitlabIssueRecord,
  gitlabMergeRequestRecord,
  incidentioRecord,
  jiraRecord,
  linearRecord,
} from '../../__tests__/fixtures/intakeCandidates';
import { candidateMatchesView, intakeCandidate, issueCandidate, pullRequestCandidate } from './boardCandidates';
import type { BoardCandidate } from './boardCandidates';
import { boardFiltersFromParams } from './boardFilters';

function offered(record: IntakeCandidateInfo): BoardCandidate {
  const candidate = intakeCandidate(record);
  if (!candidate) throw new Error(`${record.key} is offered for filing`);
  return candidate;
}

describe('intakeCandidate', () => {
  it('files each record under the identity the server holds it by', () => {
    const records = [
      githubIssueRecord(7),
      githubPullRequestRecord(12),
      gitlabIssueRecord('gitlab-issue:encoded', 'group/project#7'),
      gitlabMergeRequestRecord('gitlab-pr:encoded', 3),
      linearRecord('ENG-42'),
      jiraRecord('jira-issue:encoded', 'ENG-13'),
      incidentioRecord('incidentio:follow-up:01H', 'INC-42'),
    ];

    expect(
      records.map(record => intakeCandidate(record)).map(candidate => [candidate?.source, candidate?.sourceKey]),
    ).toEqual([
      ['github-issue', 'github:10:issue:7'],
      ['github-pr', 'github:10:pull-request:12'],
      ['gitlab-issue', 'gitlab-issue:encoded'],
      ['gitlab-pr', 'gitlab-pr:encoded'],
      ['linear-issue', 'linear:ENG-42'],
      ['jira-issue', 'jira-issue:encoded'],
      ['incidentio-follow-up', 'incidentio:follow-up:01H'],
    ]);
  });

  it('offers nothing for a record of a source no column files from', () => {
    const slack = {
      ...githubIssueRecord(7),
      externalSource: { integrationId: 'slack', type: 'thread', externalId: 'C1:1700000000.000100' },
    };

    expect(intakeCandidate(slack)).toBeUndefined();
  });

  it('describes an issue by its number and author, and a pull request by its branches', () => {
    const issue = intakeCandidate(githubIssueRecord(7, { author: 'octocat' }));
    const pullRequest = intakeCandidate(githubPullRequestRecord(12, { author: 'octocat' }));
    const mergeRequest = intakeCandidate(gitlabMergeRequestRecord('gitlab-pr:encoded', 3, { author: 'ada' }));

    expect(issue?.meta.slice(0, 2)).toEqual(['#7', 'octocat']);
    expect(pullRequest?.meta).toEqual(['#12', 'octocat', 'feature-12 → main']);
    expect(mergeRequest?.meta).toEqual(['!3', 'ada', 'feature-3 → main']);
  });

  it('describes a tracker issue by its identifier, state and assignee', () => {
    const followUp = intakeCandidate(
      incidentioRecord('incidentio:follow-up:01H', 'INC-42', { metadata: { assignee: 'Grace Hopper' } }),
    );
    const unassigned = intakeCandidate(jiraRecord('jira-issue:encoded', 'ENG-13', { state: 'In Progress' }));

    expect(followUp?.meta).toEqual(['INC-42', 'outstanding', 'Grace Hopper']);
    expect(unassigned?.meta).toEqual(['ENG-13', 'In Progress']);
  });

  it('carries the facts the server keeps for the record onto the card filed from it', () => {
    const linear = intakeCandidate(linearRecord('ENG-42', { projectId: 'linear-project-1', labels: ['bug'] }));

    expect(linear).toMatchObject({
      title: 'ENG-42',
      url: 'https://linear.app/acme/issue/ENG-42',
      metadata: { linearProjectId: 'linear-project-1', linearIssueId: 'issue-ENG-42', labels: ['bug'] },
    });
  });

  it('puts an auto-triaged GitHub issue in Triage and every other record in Intake', () => {
    const triaged = intakeCandidate(githubIssueRecord(7, { labels: [AUTO_TRIAGED_LABEL] }));
    const labelledElsewhere = intakeCandidate(linearRecord('ENG-42', { labels: [AUTO_TRIAGED_LABEL] }));

    expect(triaged?.column).toBe('triage');
    expect(intakeCandidate(githubIssueRecord(8))?.column).toBe('intake');
    expect(labelledElsewhere?.column).toBe('intake');
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
  const jira = offered(
    jiraRecord('jira-issue:encoded', 'ENG-42', {
      title: 'Fix intake sync',
      author: 'Grace',
      metadata: { assignee: 'Ada', assignees: ['Ada'] },
    }),
  );
  const incident = offered(
    incidentioRecord('incidentio:follow-up:01H', 'INC-42', {
      metadata: { assignee: 'Grace Hopper', assignees: ['Grace Hopper'] },
    }),
  );

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
