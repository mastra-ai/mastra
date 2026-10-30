import { describe, expect, it } from 'vitest';

import { evaluateRuleGroup } from '../rules/rule-group.js';
import { externallyAuthoredWorkItem } from '../rules/types.js';
import type { ExternalWorkItemSource } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { UNTRUSTED_AUTHOR_WHEN } from './intake-routing.js';

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

describe('the built-in untrusted-author condition', () => {
  const cases = Object.keys(SOURCES).flatMap(source => Object.keys(STAMPS).map(stamps => [source, stamps] as const));

  it.each(cases)('matches exactly the cards the old guard held: %s, %s', (source, stamps) => {
    const card = { title: 'Fix', metadata: STAMPS[stamps]!, externalSource: SOURCES[source]! };
    expect(evaluateRuleGroup(UNTRUSTED_AUTHOR_WHEN, cardRuleFacts(card))).toBe(externallyAuthoredWorkItem(card));
  });

  it('holds only GitHub and GitLab cards without a trust stamp', () => {
    const held = cases
      .filter(([source, stamps]) =>
        evaluateRuleGroup(
          UNTRUSTED_AUTHOR_WHEN,
          cardRuleFacts({ title: 'Fix', metadata: STAMPS[stamps]!, externalSource: SOURCES[source]! }),
        ),
      )
      .map(([source, stamps]) => `${source}: ${stamps}`);
    expect(held).toEqual(
      ['github issue', 'github pull request', 'gitlab issue', 'gitlab merge request'].flatMap(source =>
        ['no metadata', 'no stamp', 'authorTrusted false'].map(stamps => `${source}: ${stamps}`),
      ),
    );
  });
});
