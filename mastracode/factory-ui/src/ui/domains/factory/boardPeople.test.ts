import { describe, expect, it } from 'vitest';

import {
  gitlabCandidate,
  incidentioCandidate,
  issueCandidate,
  jiraCandidate,
  linearCandidate,
  pullRequestCandidate,
} from './boardCandidates';
import { boardFiltersFromParams } from './boardFilters';
import {
  boardParticipants,
  boardPersonIdentity,
  candidateMatchesPeople,
  withPeopleFolded,
  withPeopleUnfolded,
  workItemMatchesPeople,
} from './boardPeople';
import type { BoardKind } from './boardStages';
import type { AuditEventPage } from './services/audit';
import type { WorkItem } from './services/workItems';

const item: WorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'factory-rule-dispatcher',
  githubProjectId: 'factory-1',
  source: 'github-pr',
  sourceKey: 'github-pr:12',
  parentWorkItemId: null,
  title: 'Ship relevance filters',
  url: 'https://github.com/acme/app/pull/12',
  stages: ['review'],
  stageHistory: [],
  sessions: {
    review: {
      sessionId: 'session-1',
      threadId: 'thread-1',
      branch: 'review/relevance',
      startedBy: 'user-grace',
    },
  },
  metadata: {
    author: 'octocat',
    assignees: ['hubot'],
    requestedReviewers: ['monalisa'],
  },
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
};

const activityPage: AuditEventPage = {
  events: [
    {
      id: 'event-1',
      actorId: 'user-ada',
      actorType: 'human',
      action: 'factory.work_item.stage_moved',
      targets: [{ type: 'work_item', id: item.id }],
      metadata: {},
      occurredAt: '2026-08-05T09:00:00.000Z',
    },
  ],
  actors: {
    'user-ada': { id: 'user-ada', name: 'Ada Lovelace', avatarUrl: 'https://avatars.example/ada.png' },
    'user-grace': { id: 'user-grace', name: 'Grace Hopper' },
  },
};

const asIs = boardPersonIdentity(undefined, undefined);

function picks(entries: Array<[string, string]>, kind: BoardKind = 'review') {
  return boardFiltersFromParams(new URLSearchParams(entries), kind);
}

describe('board person filters', () => {
  it('matches each role filter only through its own role, and Involves through any', () => {
    const matches = (entries: Array<[string, string]>) =>
      workItemMatchesPeople(item, activityPage, picks(entries), asIs);

    expect(matches([['author', 'github:octocat']])).toBe(true);
    expect(matches([['assignee', 'github:octocat']])).toBe(false);
    expect(matches([['assignee', 'github:hubot']])).toBe(true);
    expect(matches([['reviewer', 'github:monalisa']])).toBe(true);
    expect(matches([['reviewer', 'github:hubot']])).toBe(false);
    expect(matches([['worked', 'factory:user-ada']])).toBe(true);
    expect(matches([['worked', 'factory:user-grace']])).toBe(true);
    expect(matches([['author', 'factory:user-ada']])).toBe(false);
    for (const participantId of ['github:octocat', 'github:hubot', 'github:monalisa', 'factory:user-ada']) {
      expect(matches([['teammate', participantId]])).toBe(true);
    }
    expect(matches([['teammate', 'github:nobody']])).toBe(false);
    expect(matches([])).toBe(true);
  });

  it('requires every role filter to match, and any person within one', () => {
    const matches = (entries: Array<[string, string]>) =>
      workItemMatchesPeople(item, activityPage, picks(entries), asIs);

    expect(
      matches([
        ['author', 'github:octocat'],
        ['assignee', 'github:hubot'],
      ]),
    ).toBe(true);
    expect(
      matches([
        ['author', 'github:octocat'],
        ['assignee', 'github:monalisa'],
      ]),
    ).toBe(false);
    expect(
      matches([
        ['author', 'github:octocat'],
        ['reviewer', 'github:monalisa'],
      ]),
    ).toBe(true);
    expect(
      matches([
        ['author', 'github:someone-else'],
        ['author', 'github:octocat'],
      ]),
    ).toBe(true);
  });

  it('attributes GitLab MR authors, assignees, and requested reviewers to GitLab identities', () => {
    const gitlabItem: WorkItem = { ...item, source: 'gitlab-pr' };
    const matches = (entries: Array<[string, string]>) =>
      workItemMatchesPeople(gitlabItem, undefined, picks(entries), asIs);

    expect(matches([['author', 'gitlab:octocat']])).toBe(true);
    expect(matches([['author', 'github:octocat']])).toBe(false);
    expect(matches([['assignee', 'gitlab:hubot']])).toBe(true);
    expect(matches([['reviewer', 'gitlab:monalisa']])).toBe(true);
  });

  it('matches what the live candidate says now alongside what the item stored', () => {
    const reassigned = pullRequestCandidate({
      number: 12,
      title: 'Ship relevance filters',
      url: 'https://github.com/acme/app/pull/12',
      author: 'octocat',
      assignees: ['grace'],
      requestedReviewers: [],
      baseBranch: 'main',
      headBranch: 'feat/relevance',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-02T09:00:00.000Z',
    });
    const filters = picks([
      ['author', 'github:octocat'],
      ['assignee', 'github:grace'],
    ]);

    expect(workItemMatchesPeople(item, activityPage, filters, asIs)).toBe(false);
    expect(workItemMatchesPeople(item, activityPage, filters, asIs, reassigned)).toBe(true);
  });

  it("treats the signed-in user's GitHub login as them", () => {
    const personId = boardPersonIdentity('user-octo', 'OctoCat');
    const authoredByYou = picks([['author', 'factory:user-octo']]);

    expect(workItemMatchesPeople(item, activityPage, authoredByYou, personId)).toBe(true);
    expect(workItemMatchesPeople(item, activityPage, authoredByYou, asIs)).toBe(false);
    expect(workItemMatchesPeople(item, activityPage, authoredByYou, boardPersonIdentity('user-octo', null))).toBe(
      false,
    );
    expect(workItemMatchesPeople(item, activityPage, picks([['author', 'factory:user-hubot']]), personId)).toBe(false);
  });

  it("shows the signed-in user's GitHub-login pick as them and stores it so a teammate's link still matches", () => {
    const octo = boardPersonIdentity('user-octo', 'octocat');
    const shown = withPeopleFolded(
      picks([
        ['teammate', 'github:octocat'],
        ['author', 'github:hubot'],
        ['label', 'github:octocat'],
      ]),
      octo,
    );

    expect([...shown.teammate]).toEqual(['factory:user-octo']);
    expect([...shown.author]).toEqual(['github:hubot']);
    expect([...shown.label]).toEqual(['github:octocat']);

    const stored = withPeopleUnfolded(picks([['author', 'factory:user-octo']]), octo);
    expect([...stored.author]).toEqual(['factory:user-octo', 'github:octocat']);
    const hubot = boardPersonIdentity('user-hubot', 'hubot');
    expect(workItemMatchesPeople(item, activityPage, withPeopleFolded(stored, hubot), hubot)).toBe(true);
  });

  it('offers Review requested only on review boards and ignores the retired relevance parameter', () => {
    const work = picks(
      [
        ['reviewer', 'github:monalisa'],
        ['relevance', 'assigned'],
        ['teammate', 'github:octocat'],
      ],
      'work',
    );

    expect(work.reviewer.size).toBe(0);
    expect(workItemMatchesPeople(item, activityPage, work, asIs)).toBe(true);
  });

  it('filters intake candidates by GitHub, GitLab, Linear, Jira, and incident.io provider metadata', () => {
    const githubIssue = issueCandidate({
      number: 7,
      title: 'Fix login bug',
      url: 'https://github.com/acme/app/issues/7',
      author: 'octocat',
      assignee: 'hubot',
      assignees: ['hubot', 'monalisa'],
      labels: [],
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
    const gitlab = gitlabCandidate({
      id: '7',
      externalId: 'gitlab-issue:7',
      identifier: 'group/project#7',
      title: 'Match provider metadata',
      url: 'https://gitlab.com/group/project/-/issues/7',
      state: 'opened',
      stateType: 'unstarted',
      priority: null,
      assignee: 'Grace Hopper',
      assignees: ['Grace Hopper', 'Katherine Johnson'],
      author: 'Ada Lovelace',
      source: 'group/project',
      sourceId: 'gitlab-project:7',
      labels: [],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    const linear = linearCandidate({
      id: 'linear-1',
      identifier: 'ENG-12',
      title: 'Filter the board',
      url: 'https://linear.app/acme/issue/ENG-12',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: 'Grace Hopper',
      creator: 'Ada Lovelace',
      team: 'Engineering',
      labels: [],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    const jira = jiraCandidate({
      id: 'jira-1',
      identifier: 'ENG-13',
      title: 'Filter the board from Jira',
      url: 'https://acme.atlassian.net/browse/ENG-13',
      state: 'To Do',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: 'Grace Hopper',
      author: 'Ada Lovelace',
      project: 'ENG',
      site: 'acme.atlassian.net',
      labels: [],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
      sourceId: '10001',
    });

    const incidentio = incidentioCandidate({
      id: 'incidentio:follow-up:01HFOLLOWUP',
      identifier: 'INC-42',
      title: 'Add database failover alert',
      url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
      state: 'outstanding',
      stateType: 'unstarted',
      priorityLabel: 'Urgent',
      assignee: 'Grace Hopper',
      author: 'Ada Lovelace',
      incident: 'incident-1',
      labels: [],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
      sourceId: 'incidentio:follow-ups',
    });

    const matches = (candidate: Parameters<typeof candidateMatchesPeople>[0], fieldId: string, participantId: string) =>
      candidateMatchesPeople(candidate, picks([[fieldId, participantId]]), asIs);

    expect(matches(githubIssue, 'assignee', 'github:hubot')).toBe(true);
    expect(matches(githubIssue, 'assignee', 'github:monalisa')).toBe(true);
    expect(matches(githubIssue, 'author', 'github:hubot')).toBe(false);
    expect(matches(githubPr, 'reviewer', 'github:monalisa')).toBe(true);
    expect(matches(gitlab, 'author', 'gitlab:ada lovelace')).toBe(true);
    expect(matches(gitlab, 'assignee', 'gitlab:katherine johnson')).toBe(true);
    expect(matches(linear, 'author', 'linear:ada lovelace')).toBe(true);
    expect(matches(linear, 'assignee', 'linear:grace hopper')).toBe(true);
    expect(matches(jira, 'author', 'jira:ada lovelace')).toBe(true);
    expect(matches(jira, 'assignee', 'jira:grace hopper')).toBe(true);
    expect(matches(incidentio, 'author', 'incidentio:ada lovelace')).toBe(true);
    expect(matches(incidentio, 'assignee', 'incidentio:grace hopper')).toBe(true);
    expect(matches(linear, 'worked', 'linear:ada lovelace')).toBe(false);
  });

  it('builds a named people list from auth, audit, and provider metadata without raw Factory ids', () => {
    const participants = boardParticipants({
      items: [item],
      candidates: [],
      activityPage,
      currentUser: { userId: 'user-current', name: 'Katherine Johnson' },
      personId: asIs,
    });

    expect(participants.map(participant => participant.id)).toEqual([
      'factory:user-ada',
      'factory:user-grace',
      'github:hubot',
      'factory:user-current',
      'github:monalisa',
      'github:octocat',
    ]);
    expect(participants.find(participant => participant.id === 'github:octocat')?.avatarUrl).toContain(
      'github.com/octocat.png',
    );
    expect(participants.some(participant => participant.name === 'user-current')).toBe(false);
  });

  it('lists the signed-in user once, with their GitHub avatar, instead of beside their GitHub login', () => {
    const participants = boardParticipants({
      items: [item],
      candidates: [],
      activityPage,
      currentUser: { userId: 'user-octo', name: 'Octo Cat' },
      personId: boardPersonIdentity('user-octo', 'octocat'),
    });

    expect(participants.map(participant => participant.id)).not.toContain('github:octocat');
    const you = participants.find(participant => participant.id === 'factory:user-octo');
    expect(you?.name).toBe('Octo Cat');
    expect(you?.avatarUrl).toContain('github.com/octocat.png');
  });
});
