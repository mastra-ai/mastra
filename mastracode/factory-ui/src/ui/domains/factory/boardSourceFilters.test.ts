import { describe, expect, it } from 'vitest';
import { linearCandidate } from './boardCandidates';
import { boardFilterItems, boardFilterParams, boardFilterStateFromItems, boardFiltersFromParams } from './boardFilters';
import { boardSource, cardMatchesSourceFilters } from './boardSourceFilters';
import { linearIssue, sourceCards } from '../../__tests__/fixtures/boardSourceFilters';

describe('Board source filters', () => {
  it('preserves multiple sources and projects through URL and saved view filters', () => {
    const params = new URLSearchParams(
      'source=github&source=linear&linearProject=project-a&linearProject=project-b&q=Portal&label=feature&sort=created-newest',
    );
    const state = boardFiltersFromParams(params, 'work');
    const restored = boardFilterStateFromItems(boardFilterItems(state, 'work'), 'work');
    const url = boardFilterParams(params, restored, 'work');
    expect(url.getAll('source')).toEqual(['github', 'linear']);
    expect(url.getAll('linearProject')).toEqual(['project-a', 'project-b']);
    expect(url.get('q')).toBe('Portal');
    expect(url.get('sort')).toBe('created-newest');
  });

  it('does not use an old stored project when the live issue has no project', () => {
    const card = sourceCards[0];
    const filters = boardFiltersFromParams(new URLSearchParams('linearProject=project-a'), 'work');
    expect(cardMatchesSourceFilters(card, filters)).toBe(true);
    expect(cardMatchesSourceFilters(card, filters, linearCandidate(linearIssue('ENG-102', null)))).toBe(false);
  });

  it('groups issue and pull request sources under their providers', () => {
    expect(boardSource('github-issue')).toBe('github');
    expect(boardSource('github-pr')).toBe('github');
    expect(boardSource('gitlab-pr')).toBe('gitlab');
    expect(boardSource('incidentio-follow-up')).toBe('incidentio');
    expect(boardSource('manual')).toBe('manual');
  });
});
