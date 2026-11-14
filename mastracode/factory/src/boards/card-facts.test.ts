import { describe, expect, it } from 'vitest';

import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleGroup } from '../rules/rule-group.js';
import { externallyAuthoredWorkItem } from '../rules/types.js';
import { DEFAULT_INTAKE_ROUTE } from '../storage/domains/boards/base.js';
import type { Card, ExternalWorkItemSource } from '../storage/domains/work-items/base.js';
import { workItemProviderAdapter } from '../work-items/providers/index.js';
import { cardRuleFacts } from './card-facts.js';

const SOURCES: Record<string, ExternalWorkItemSource | null> = {
  manual: null,
  'github issue': { integrationId: 'github', type: 'issue', externalId: 'acme/app#1' },
  'github pull request': { integrationId: 'github', type: 'pull-request', externalId: 'acme/app#2' },
  'gitlab issue': { integrationId: 'gitlab', type: 'issue', externalId: 'acme/app#3' },
  'gitlab merge request': { integrationId: 'gitlab', type: 'pull-request', externalId: 'acme/app!4' },
  'linear issue': { integrationId: 'linear', type: 'issue', externalId: 'ENG-5' },
  'jira issue': { integrationId: 'jira', type: 'issue', externalId: 'OPS-6' },
  'incident.io follow-up': { integrationId: 'incidentio', type: 'follow-up', externalId: 'inc-7' },
  'slack thread': { integrationId: 'slack', type: 'thread', workspaceId: 'T0ABC', externalId: '1700000000.0001' },
};

const STAMPS: Record<string, Record<string, unknown> | null> = {
  'no metadata': null,
  'no stamp': { labels: ['bug'] },
  'authorTrusted true': { authorTrusted: true },
  'authorTrusted false': { authorTrusted: false },
  'factoryAuthored true': { factoryAuthored: true },
  'factoryAuthored true, authorTrusted false': { factoryAuthored: true, authorTrusted: false },
};

describe('provider facts', () => {
  it.each([false, true])('keeps native labels and authors available to rules (persisted: %s)', persisted => {
    const facts = cardRuleFacts({
      title: 'Write the guide',
      externalSource: null,
      metadata: { labels: ['docs', 42], author: 'writer', authorTrusted: true },
      ...(persisted ? { workItem: { labels: [], author: null } } : {}),
    });
    expect(facts).toMatchObject({
      'item.labels': ['docs'],
      'item.author': 'writer',
      'author.trusted': true,
    });
  });

  it.each([{ labels: [] }, { labels: ['bug'] }])(
    'uses normalized provider labels $labels while keeping placement trust authoritative',
    ({ labels }) => {
      const facts = cardRuleFacts({
        title: 'Fix',
        externalSource: SOURCES['github issue']!,
        metadata: { labels: ['stale'], author: 'stale-author', authorTrusted: false },
        workItem: { labels, author: 'provider-author' },
      });
      expect(facts).toMatchObject({
        'item.labels': labels,
        'item.author': 'provider-author',
        'author.trusted': false,
      });
    },
  );

  it('normalizes incoming source facts before the arrival has a persisted work item', () => {
    const facts = cardRuleFacts({
      title: 'Fix',
      externalSource: SOURCES['github issue']!,
      metadata: { labels: [{ name: 'bug' }], author: 'provider-author', authorTrusted: true },
    });
    expect(facts).toMatchObject({
      'item.labels': ['bug'],
      'item.author': 'provider-author',
      'author.trusted': true,
    });
  });
});

describe('where an item lives, its key, state and assignees', () => {
  const ARRIVALS = [
    {
      name: 'GitHub issue',
      source: {
        integrationId: 'github',
        type: 'issue',
        externalId: 'github:7:issue:12',
        url: 'https://github.com/Acme/App/issues/12',
      },
      metadata: { githubRepositoryId: 7, githubIssueNumber: 12, state: 'open', assignees: ['octocat'] },
      facts: {
        'source.provider': 'github',
        'source.repository': 'Acme/App',
        'item.key': 'Acme/App#12',
        'item.state': 'open',
        'item.assignees': ['octocat'],
      },
    },
    {
      name: 'GitLab merge request in a subgroup',
      source: {
        integrationId: 'gitlab',
        type: 'pull-request',
        externalId: 'gitlab:9:mr:7',
        url: 'https://gitlab.com/acme/platform/api/-/merge_requests/7',
      },
      metadata: { gitlabMergeRequestIid: 7, merged: true, assignees: [] },
      facts: {
        'source.provider': 'gitlab',
        'source.repository': 'acme/platform/api',
        'item.key': 'acme/platform/api!7',
        'item.state': 'merged',
        'item.assignees': [],
      },
    },
    {
      name: 'Linear issue',
      source: { integrationId: 'linear', type: 'issue', externalId: 'linear:ENG-5' },
      metadata: { identifier: 'ENG-5', linearState: 'In Progress', linearTeam: 'ENG', assignee: 'Ada' },
      facts: {
        'source.provider': 'linear',
        'source.repository': 'ENG',
        'item.key': 'ENG-5',
        'item.state': 'In Progress',
        'item.assignees': ['Ada'],
      },
    },
    {
      name: 'Jira issue',
      source: { integrationId: 'jira', type: 'issue', externalId: '10042' },
      metadata: { identifier: 'OPS-6', state: 'To Do', project: 'OPS', assignees: ['Grace'] },
      facts: {
        'source.provider': 'jira',
        'source.repository': 'OPS',
        'item.key': 'OPS-6',
        'item.state': 'To Do',
        'item.assignees': ['Grace'],
      },
    },
  ] as const;

  it.each(ARRIVALS)(
    'reads them off a $name arriving, as its work item will store them',
    ({ source, metadata, facts }) => {
      expect(cardRuleFacts({ title: 'Fix', externalSource: source, metadata })).toMatchObject(facts);
    },
  );

  it.each(ARRIVALS)(
    "reads them off a $name card's stored work item, which a phase rule tests",
    ({ source, metadata, facts }) => {
      // A filed card's provider facts live on its work item; the card keeps only Factory's own metadata.
      const workItem = workItemProviderAdapter(source).toSource(source, metadata)!;
      expect(
        cardRuleFacts({ title: 'Fix', externalSource: source, metadata: { authorTrusted: true }, workItem }),
      ).toMatchObject(facts);
    },
  );

  it('takes the team or project from the key when the provider metadata leaves it out', () => {
    const facts = (integrationId: string, identifier: string) =>
      cardRuleFacts({
        title: 'Fix',
        externalSource: { integrationId, type: 'issue', externalId: identifier },
        metadata: { identifier },
      });
    expect(facts('linear', 'ENG-5')['source.repository']).toBe('ENG');
    expect(facts('jira', 'OPS-6')['source.repository']).toBe('OPS');
  });

  it('has no repository for an incident.io follow-up or a GitHub item without its URL, and none of these facts for a manual card', () => {
    const incident = cardRuleFacts({
      title: 'Follow up',
      externalSource: { integrationId: 'incidentio', type: 'follow-up', externalId: 'inc-7' },
      metadata: { identifier: 'INC-7', state: 'Open' },
    });
    expect(incident).toMatchObject({ 'source.provider': 'incidentio', 'item.key': 'INC-7', 'item.state': 'Open' });
    expect(incident).not.toHaveProperty('source.repository');
    expect(
      cardRuleFacts({ title: 'Fix', externalSource: SOURCES['github issue']!, metadata: { githubIssueNumber: 1 } }),
    ).not.toHaveProperty('source.repository');
    const manual = cardRuleFacts({ title: 'Fix', externalSource: null, metadata: {} });
    expect(manual).not.toHaveProperty('source.repository');
    expect(manual).not.toHaveProperty('source.provider');
    expect(manual).not.toHaveProperty('item.key');
  });
});

describe('item.pullRequest', () => {
  const pullRequest = (number: number, state: string) =>
    ({
      sourceType: 'pull-request',
      state,
      metadata: { githubPullRequestNumber: number },
    }) as unknown as Card['workItem']['sources'][number];
  const issueCard = (sources: Card['workItem']['sources'], metadata: Record<string, unknown> = {}) => ({
    title: 'Fix',
    externalSource: SOURCES['github issue']!,
    metadata,
    workItem: { labels: [], author: null, sources },
  });
  const noPullRequest: RuleGroup = {
    operator: 'AND',
    conditions: [{ field: 'item.pullRequest', operator: 'not_exists' }],
  };

  it('is absent while the card has no open change request', () => {
    for (const card of [issueCard([]), issueCard([pullRequest(12, 'closed'), pullRequest(13, 'merged')])]) {
      const facts = cardRuleFacts(card);
      expect(facts).not.toHaveProperty('item.pullRequest');
      expect(evaluateRuleGroup(noPullRequest, facts)).toBe(true);
    }
  });

  it('is the open change request attached to the card, or the one Factory opened', () => {
    const attached = cardRuleFacts(issueCard([pullRequest(12, 'closed'), pullRequest(14, 'open')]));
    expect(attached['item.pullRequest']).toBe(14);
    expect(evaluateRuleGroup(noPullRequest, attached)).toBe(false);

    expect(cardRuleFacts(issueCard([], { openPullRequestNumber: 21 }))['item.pullRequest']).toBe(21);
  });
});

describe('item.hasPullRequest and item.hasIssue', () => {
  const source = (sourceType: string, state: string, metadata: Record<string, unknown> = {}) =>
    ({ sourceType, state, metadata }) as unknown as Card['workItem']['sources'][number];
  const card = (kind: 'github issue' | 'github pull request', sources: Card['workItem']['sources']) => ({
    title: 'Fix',
    externalSource: SOURCES[kind]!,
    metadata: {},
    workItem: { labels: [], author: null, sources },
  });
  const openPullRequest = source('pull-request', 'open', { githubPullRequestNumber: 7 });

  it('says yes for an issue with an open pull request attached, no once it closed or merged', () => {
    expect(cardRuleFacts(card('github issue', [source('issue', 'open'), openPullRequest]))).toMatchObject({
      'item.hasPullRequest': true,
      'item.hasIssue': true,
    });
    const settled = cardRuleFacts(
      card('github issue', [source('issue', 'open'), source('pull-request', 'merged', { githubPullRequestNumber: 7 })]),
    );
    expect(settled['item.hasPullRequest']).toBe(false);
    expect(cardRuleFacts(card('github issue', [source('issue', 'open')]))).toMatchObject({
      'item.hasPullRequest': false,
      'item.hasIssue': false,
    });
  });

  it('says no issue for a pull request on its own card, yes once it links one', () => {
    expect(cardRuleFacts(card('github pull request', [openPullRequest]))['item.hasIssue']).toBe(false);
    expect(
      cardRuleFacts(card('github pull request', [openPullRequest, source('issue', 'open')]))['item.hasIssue'],
    ).toBe(true);
  });
});

describe('author.trusted', () => {
  it.each([
    ['authorTrusted true', true],
    ['factoryAuthored true', true],
    ['factoryAuthored true, authorTrusted false', true],
    ['authorTrusted false', false],
    ['no stamp', false],
    ['no metadata', false],
  ])('is %s → %s', (stamps, trusted) => {
    const facts = cardRuleFacts({ title: 'Fix', metadata: STAMPS[stamps]!, externalSource: SOURCES['github issue']! });
    expect(facts['author.trusted']).toBe(trusted);
  });

  it('only counts a literal true stamp, not a truthy one', () => {
    const facts = cardRuleFacts({
      title: 'Fix',
      metadata: { authorTrusted: 'true', factoryAuthored: 1 },
      externalSource: SOURCES['github issue']!,
    });
    expect(facts['author.trusted']).toBe(false);
  });
});

describe("the default intake route's condition", () => {
  const OUTSIDE_AUTHOR = DEFAULT_INTAKE_ROUTE.when!;
  const cases = Object.keys(SOURCES).flatMap(source => Object.keys(STAMPS).map(stamps => [source, stamps] as const));

  it.each(cases)('matches exactly the cards from outside the write-access circle: %s, %s', (source, stamps) => {
    const card = { title: 'Fix', metadata: STAMPS[stamps]!, externalSource: SOURCES[source]! };
    expect(evaluateRuleGroup(OUTSIDE_AUTHOR, cardRuleFacts(card))).toBe(externallyAuthoredWorkItem(card));
  });

  it('matches only GitHub and GitLab cards without a trust stamp', () => {
    const matched = cases
      .filter(([source, stamps]) =>
        evaluateRuleGroup(
          OUTSIDE_AUTHOR,
          cardRuleFacts({ title: 'Fix', metadata: STAMPS[stamps]!, externalSource: SOURCES[source]! }),
        ),
      )
      .map(([source, stamps]) => `${source}: ${stamps}`);
    expect(matched).toEqual(
      ['github issue', 'github pull request', 'gitlab issue', 'gitlab merge request'].flatMap(source =>
        ['no metadata', 'no stamp', 'authorTrusted false'].map(stamps => `${source}: ${stamps}`),
      ),
    );
  });
});
