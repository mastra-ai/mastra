import { matchesSourceFilters } from '@mastra/factory/work-items/card-source-filters';
import { describe, expect, it } from 'vitest';
import { boardFilterFields } from './components/boardFilterFields';
import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  withBoardFilterValues,
} from './boardFilters';

describe('Board source filters', () => {
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
