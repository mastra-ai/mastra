import { describe, expect, it } from 'vitest';

import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleGroup } from '../rules/rule-group.js';
import { externallyAuthoredWorkItem } from '../rules/types.js';
import { DEFAULT_INTAKE_ROUTE } from '../storage/domains/boards/base.js';
import type { Card, ExternalWorkItemSource } from '../storage/domains/work-items/base.js';
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
