import { describe, expect, it } from 'vitest';
import { linearCandidate } from './boardCandidates';
import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  withBoardFilterValues,
} from './boardFilters';
import { boardSource, cardMatchesSourceFilters } from './boardSourceFilters';
import type { WorkItem } from './services/workItems';
import { linearIssue, sourceCards } from '../../__tests__/fixtures/boardSourceFilters';

describe('Board source filters', () => {
  it('preserves every filter through URL and saved view filters', () => {
    const params = new URLSearchParams(
      'source=github&source=linear&linearProject=project-a&linearProject=project-b&author=github%3Aalice&assignee=github%3Abob&label=needs%2Creview&label=p0&sort=created-newest',
    );
    const state = boardFiltersFromParams(params, 'work');
    const restored = boardFilterStateFromItems(boardFilterItems(state), 'work');
    const url = boardFilterParams(params, restored);
    expect(url.getAll('source')).toEqual(['github', 'linear']);
    expect(url.getAll('linearProject')).toEqual(['project-a', 'project-b']);
    expect(url.getAll('author')).toEqual(['github:alice']);
    expect(url.getAll('assignee')).toEqual(['github:bob']);
    expect(url.getAll('label')).toEqual(['needs,review', 'p0']);
    expect(url.get('sort')).toBe('created-newest');
  });

  it('does not use an old stored project when the live issue has no project', () => {
    const card = sourceCards[0];
    const filters = boardFiltersFromParams(new URLSearchParams('linearProject=project-a'), 'work');
    expect(cardMatchesSourceFilters(card, filters)).toBe(true);
    expect(cardMatchesSourceFilters(card, filters, linearCandidate(linearIssue('ENG-102', null)))).toBe(false);
  });

  it('narrows only Linear cards by project when other sources are picked too', () => {
    const github: Pick<WorkItem, 'source' | 'metadata'> = { source: 'github-issue', metadata: {} };
    const filters = boardFiltersFromParams(
      new URLSearchParams('source=github&source=linear&linearProject=project-b'),
      'work',
    );
    expect(cardMatchesSourceFilters(github, filters)).toBe(true);
    expect(cardMatchesSourceFilters(sourceCards[0], filters)).toBe(false);
    expect(
      cardMatchesSourceFilters(github, boardFiltersFromParams(new URLSearchParams('linearProject=project-b'), 'work')),
    ).toBe(false);
  });

  it('drops picked Linear projects once Linear is no longer a picked source', () => {
    const filters = boardFiltersFromParams(new URLSearchParams('source=linear&linearProject=project-a'), 'work');
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
