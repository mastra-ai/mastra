import { describe, expect, it } from 'vitest';
import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  withBoardFilterValues,
} from './boardFilters';

describe('Board source filters', () => {
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
