import { describe, expect, it } from 'vitest';

import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';

import {
  githubIssueRecord,
  githubPullRequestRecord,
  gitlabIssueRecord,
  gitlabMergeRequestRecord,
  incidentioRecord,
  jiraRecord,
  linearRecord,
} from '../../__tests__/fixtures/intakeCandidates';
import { intakeCandidate } from './boardCandidates';

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
