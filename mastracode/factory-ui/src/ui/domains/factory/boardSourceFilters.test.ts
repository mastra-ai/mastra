import { boardSource, matchesSourceFilters } from '@mastra/factory/work-items/card-source-filters';
import { describe, expect, it } from 'vitest';
import { boardFilterFields } from './components/boardFilterFields';
import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  withBoardFilterValues,
} from './boardFilters';
import { BOARD_SOURCE_OPTIONS } from './boardSourceFilters';
import { CARD_SOURCES } from './cardSources';
import type { WorkItemSource } from './services/workItems';

function isCardSource(key: string): key is WorkItemSource {
  return key in CARD_SOURCES;
}

describe('Board source filters', () => {
  // The server files each card under `boardSource` of its source. A source with no menu entry can't be
  // filtered to, and picking "Manual" hides its cards: Vanta's vulnerabilities were in that state.
  // Slack threads aren't offered yet: the board has no Slack connection status to offer them by.
  it.each(
    Object.keys(CARD_SOURCES)
      .filter(isCardSource)
      .filter(source => source !== 'slack-thread'),
  )('offers the source that %s cards are filed under', source => {
    const offered: string[] = BOARD_SOURCE_OPTIONS.map(option => option.value);
    expect(offered).toContain(boardSource(source));
  });

  it('offers Detail findings even without a connected source and filters them from other cards', () => {
    const state = boardFiltersFromParams(new URLSearchParams(), false);
    const source = boardFilterFields({
      reviewsPullRequests: false,
      filters: state,
      participants: [],
      availableLabels: [],
      connectedSources: new Set(),
    }).find(field => field.id === 'source');

    expect(source?.suggestions).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'detail', label: 'Detail' })]),
    );
    const selected = withBoardFilterValues(state, 'source', ['detail']);
    expect(matchesSourceFilters({ source: 'detail-finding', metadata: {}, hasPullRequest: false }, selected)).toBe(
      true,
    );
    expect(matchesSourceFilters({ source: 'manual', metadata: {}, hasPullRequest: false }, selected)).toBe(false);
  });

  it('preserves every filter through URL and saved view filters', () => {
    const params = new URLSearchParams(
      'source=github&source=linear&linearProject=project-a&linearProject=project-b&author=github%3Aalice&assignee=github%3Abob&label=needs%2Creview&label=p0&sort=created-newest',
    );
    const state = boardFiltersFromParams(params, true);
    const restored = boardFilterStateFromItems(boardFilterItems(state), true);
    const url = boardFilterParams(params, restored);
    expect(url.getAll('source')).toEqual(['github', 'linear']);
    expect(url.getAll('linearProject')).toEqual(['project-a', 'project-b']);
    expect(url.getAll('author')).toEqual(['github:alice']);
    expect(url.getAll('assignee')).toEqual(['github:bob']);
    expect(url.getAll('label')).toEqual(['needs,review', 'p0']);
    expect(url.get('sort')).toBe('created-newest');
  });

  it('drops picked Linear projects once Linear is no longer a picked source', () => {
    const filters = boardFiltersFromParams(new URLSearchParams('source=linear&linearProject=project-a'), true);
    expect([...withBoardFilterValues(filters, 'source', ['linear', 'github']).linearProject]).toEqual(['project-a']);
    expect(withBoardFilterValues(filters, 'source', ['github']).linearProject.size).toBe(0);
  });
});
