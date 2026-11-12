import { describe, expect, it } from 'vitest';
import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  withBoardFilterValues,
} from './boardFilters';
import { boardSource, cardMatchesSourceFilters } from './boardSourceFilters';
import type { WorkItem } from './services/workItems';
import { sourceCards } from '../../__tests__/fixtures/boardSourceFilters';

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

  it('narrows a Linear card by the project its stored facts name', () => {
    const card = sourceCards[0];
    expect(
      cardMatchesSourceFilters(card, boardFiltersFromParams(new URLSearchParams('linearProject=project-a'), true)),
    ).toBe(true);
    expect(
      cardMatchesSourceFilters(card, boardFiltersFromParams(new URLSearchParams('linearProject=project-b'), true)),
    ).toBe(false);
  });

  it('narrows only Linear cards by project when other sources are picked too', () => {
    const github: Pick<WorkItem, 'source' | 'metadata'> = { source: 'github-issue', metadata: {} };
    const filters = boardFiltersFromParams(
      new URLSearchParams('source=github&source=linear&linearProject=project-b'),
      true,
    );
    expect(cardMatchesSourceFilters(github, filters)).toBe(true);
    expect(cardMatchesSourceFilters(sourceCards[0], filters)).toBe(false);
    expect(
      cardMatchesSourceFilters(github, boardFiltersFromParams(new URLSearchParams('linearProject=project-b'), true)),
    ).toBe(false);
  });

  it('drops picked Linear projects once Linear is no longer a picked source', () => {
    const filters = boardFiltersFromParams(new URLSearchParams('source=linear&linearProject=project-a'), true);
    expect([...withBoardFilterValues(filters, 'source', ['linear', 'github']).linearProject]).toEqual(['project-a']);
    expect(withBoardFilterValues(filters, 'source', ['github']).linearProject.size).toBe(0);
  });

  it('groups issue and pull request sources under their providers', () => {
    expect(boardSource('github-issue')).toBe('github');
    expect(boardSource('github-pr')).toBe('github');
    expect(boardSource('gitlab-pr')).toBe('gitlab');
    expect(boardSource('incidentio-follow-up')).toBe('incidentio');
    expect(boardSource('manual')).toBe('manual');
  });
});
