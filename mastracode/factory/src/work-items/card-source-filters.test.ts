import { describe, expect, it } from 'vitest';

import { hasEveryLabel, metadataLabels } from './card-labels.js';
import { boardSource, matchesSourceFilters, PULL_REQUEST_SOURCE_FILTER } from './card-source-filters.js';
import type { SourceFacts } from './card-source-filters.js';

function filters(source: string[] = [], linearProject: string[] = []) {
  return { source: new Set(source), linearProject: new Set(linearProject) };
}

function card(source: SourceFacts['source'], more: { linearProjectId?: string; hasPullRequest?: boolean } = {}) {
  return {
    source,
    metadata: more.linearProjectId === undefined ? {} : { linearProjectId: more.linearProjectId },
    hasPullRequest: more.hasPullRequest ?? false,
  };
}

describe('boardSource', () => {
  it.each([
    ['github-issue', 'github'],
    ['github-pr', 'github'],
    ['gitlab-pr', 'gitlab'],
    ['linear-issue', 'linear'],
    ['jira-issue', 'jira'],
    ['incidentio-follow-up', 'incidentio'],
    ['slack-thread', 'slack'],
    ['manual', 'manual'],
  ] as const)('files a %s card under %s', (source, filedUnder) => {
    expect(boardSource(source)).toBe(filedUnder);
  });
});

describe('matchesSourceFilters', () => {
  it('keeps every card when nothing is picked', () => {
    expect(matchesSourceFilters(card('manual'), filters())).toBe(true);
    expect(matchesSourceFilters(card('linear-issue'), filters())).toBe(true);
  });

  it('keeps the cards of any picked source', () => {
    const picked = filters(['github', 'manual']);

    expect(matchesSourceFilters(card('github-pr'), picked)).toBe(true);
    expect(matchesSourceFilters(card('manual'), picked)).toBe(true);
    expect(matchesSourceFilters(card('linear-issue'), picked)).toBe(false);
    // A Slack thread is not a card filed by hand.
    expect(matchesSourceFilters(card('slack-thread'), picked)).toBe(false);
  });

  it('keeps every card that has a pull request when pull requests are picked, whatever filed it', () => {
    const picked = filters([PULL_REQUEST_SOURCE_FILTER]);

    expect(matchesSourceFilters(card('linear-issue', { hasPullRequest: true }), picked)).toBe(true);
    expect(matchesSourceFilters(card('manual', { hasPullRequest: true }), picked)).toBe(true);
    expect(matchesSourceFilters(card('github-issue'), picked)).toBe(false);
  });

  it('keeps only the Linear cards of a project picked alone', () => {
    const picked = filters([], ['project-a']);

    expect(matchesSourceFilters(card('linear-issue', { linearProjectId: 'project-a' }), picked)).toBe(true);
    expect(matchesSourceFilters(card('linear-issue', { linearProjectId: 'project-b' }), picked)).toBe(false);
    expect(matchesSourceFilters(card('linear-issue'), picked)).toBe(false);
    expect(matchesSourceFilters(card('github-issue'), picked)).toBe(false);
  });

  it('narrows only the Linear cards when a project is picked beside other sources', () => {
    const picked = filters(['github', 'linear'], ['project-a']);

    expect(matchesSourceFilters(card('github-issue'), picked)).toBe(true);
    expect(matchesSourceFilters(card('linear-issue', { linearProjectId: 'project-a' }), picked)).toBe(true);
    expect(matchesSourceFilters(card('linear-issue', { linearProjectId: 'project-b' }), picked)).toBe(false);
  });
});

describe('card labels', () => {
  it('reads the text labels a source put on an item', () => {
    expect(metadataLabels({ labels: ['bug', 7, null, 'Memory'] })).toEqual(['bug', 'Memory']);
    expect(metadataLabels({ labels: 'bug' })).toEqual([]);
    expect(metadataLabels({})).toEqual([]);
  });

  it('needs every picked label on the item', () => {
    const labels = new Set(['bug', 'Memory']);

    expect(hasEveryLabel(labels, [])).toBe(true);
    expect(hasEveryLabel(labels, ['bug', 'Memory'])).toBe(true);
    expect(hasEveryLabel(labels, ['bug', 'docs'])).toBe(false);
    expect(hasEveryLabel(labels, ['memory'])).toBe(false);
  });
});
