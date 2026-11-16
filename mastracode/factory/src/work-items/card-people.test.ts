import { describe, expect, it } from 'vitest';

import { matchesPeople, providerPeople } from './card-people.js';
import type { BoardPeopleFilters, BoardRelations } from './card-people.js';

const NO_ONE = { authored: [], assigned: [], 'review-requested': [] };

function picked(filters: Partial<Record<keyof BoardPeopleFilters, string[]>>): BoardPeopleFilters {
  return {
    teammate: new Set(filters.teammate),
    author: new Set(filters.author),
    assignee: new Set(filters.assignee),
    reviewer: new Set(filters.reviewer),
    worked: new Set(filters.worked),
  };
}

function relations(byRole: Partial<Record<keyof BoardRelations, string[]>>): BoardRelations {
  return {
    worked: new Set(byRole.worked),
    authored: new Set(byRole.authored),
    assigned: new Set(byRole.assigned),
    'review-requested': new Set(byRole['review-requested']),
  };
}

describe('providerPeople', () => {
  it('names a GitHub pull request’s author, assignees and requested reviewers, with ids that ignore case', () => {
    const people = providerPeople({
      source: 'github-pr',
      metadata: { author: 'Octocat', assignees: ['Hubot', 'monalisa'], requestedReviewers: ['Defunkt'] },
    });

    expect(people).toEqual({
      authored: [{ id: 'github:octocat', name: 'Octocat', source: 'github' }],
      assigned: [
        { id: 'github:hubot', name: 'Hubot', source: 'github' },
        { id: 'github:monalisa', name: 'monalisa', source: 'github' },
      ],
      'review-requested': [{ id: 'github:defunkt', name: 'Defunkt', source: 'github' }],
    });
  });

  it('names a single assignee once when the source lists them both ways', () => {
    const people = providerPeople({
      source: 'gitlab-issue',
      metadata: { assignees: ['hubot'], assignee: 'hubot' },
    });

    expect(people.assigned).toEqual([{ id: 'gitlab:hubot', name: 'hubot', source: 'gitlab' }]);
  });

  it('asks no review of an issue, whatever its metadata says', () => {
    const people = providerPeople({ source: 'github-issue', metadata: { requestedReviewers: ['defunkt'] } });

    expect(people['review-requested']).toEqual([]);
  });

  it.each([
    ['its creator', { creator: 'Ada', linearCreator: 'Grace', author: 'Linus' }, 'Ada'],
    ['its Linear creator when it names no creator', { linearCreator: 'Grace', author: 'Linus' }, 'Grace'],
    ['its author when it names neither', { author: 'Linus' }, 'Linus'],
  ])('reads the author of a Linear issue from %s', (_case, metadata, name) => {
    expect(providerPeople({ source: 'linear-issue', metadata }).authored).toEqual([
      { id: `linear:${name.toLowerCase()}`, name, source: 'linear' },
    ]);
  });

  it('reads the one assignee of a Jira issue or an incident.io follow-up', () => {
    expect(providerPeople({ source: 'jira-issue', metadata: { assignee: 'Ada' } }).assigned).toEqual([
      { id: 'jira:ada', name: 'Ada', source: 'jira' },
    ]);
    expect(providerPeople({ source: 'incidentio-follow-up', metadata: { linearAssignee: 'Grace' } }).assigned).toEqual([
      { id: 'incidentio:grace', name: 'Grace', source: 'incidentio' },
    ]);
  });

  it('drops blank and non-text names, and trims the others', () => {
    const people = providerPeople({
      source: 'github-issue',
      metadata: { author: '   ', assignees: [' hubot ', '', 7, null] },
    });

    expect(people.authored).toEqual([]);
    expect(people.assigned).toEqual([{ id: 'github:hubot', name: 'hubot', source: 'github' }]);
  });

  it.each(['manual', 'slack-thread'] as const)('names no one for a %s card', source => {
    expect(providerPeople({ source, metadata: { author: 'octocat', assignee: 'hubot' } })).toEqual(NO_ONE);
  });
});

describe('matchesPeople', () => {
  const card = relations({
    worked: ['factory:u1'],
    authored: ['github:octocat'],
    assigned: ['github:hubot'],
    'review-requested': ['github:defunkt'],
  });

  it('keeps every card when no person is picked', () => {
    expect(matchesPeople(relations({}), picked({}))).toBe(true);
  });

  it.each([
    ['author', 'github:octocat'],
    ['assignee', 'github:hubot'],
    ['reviewer', 'github:defunkt'],
    ['worked', 'factory:u1'],
  ] as const)('matches the %s filter on that role only', (field, id) => {
    expect(matchesPeople(card, picked({ [field]: [id] }))).toBe(true);
    // The same person picked under another role is someone else's card.
    const other = field === 'author' ? 'assignee' : 'author';
    expect(matchesPeople(card, picked({ [other]: [id] }))).toBe(false);
  });

  it('matches the teammate filter on any role', () => {
    for (const id of ['factory:u1', 'github:octocat', 'github:hubot', 'github:defunkt']) {
      expect(matchesPeople(card, picked({ teammate: [id] }))).toBe(true);
    }
    expect(matchesPeople(card, picked({ teammate: ['github:stranger'] }))).toBe(false);
  });

  it('needs one of the picked people in a field, and every field to match', () => {
    expect(matchesPeople(card, picked({ author: ['github:stranger', 'github:octocat'] }))).toBe(true);
    expect(matchesPeople(card, picked({ author: ['github:octocat'], assignee: ['github:stranger'] }))).toBe(false);
  });

  it('compares ids as sent', () => {
    expect(matchesPeople(card, picked({ author: ['github:Octocat'] }))).toBe(false);
  });
});
