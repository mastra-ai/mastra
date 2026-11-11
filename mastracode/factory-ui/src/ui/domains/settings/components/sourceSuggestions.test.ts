import { describe, expect, it } from 'vitest';

import { limitedProviders, narrowSuggestions, sourceSuggestions } from './sourceSuggestions';

describe('sourceSuggestions', () => {
  it("offers the project's repositories, then the keys of its own Linear and Jira sources, once each", () => {
    const options = sourceSuggestions({
      factoryProjectId: 'fp-1',
      repositories: [
        { projectRepositoryId: 'r1', slug: 'acme/app' },
        { projectRepositoryId: 'r2', slug: 'acme/platform/api', provider: 'gitlab' },
      ],
      bindings: [
        { integrationId: 'linear', sourceId: 'lp-1', factoryProjectId: 'fp-1' },
        { integrationId: 'linear', sourceId: 'linear-team:t-eng', factoryProjectId: 'fp-1' },
        { integrationId: 'linear', sourceId: 'linear-team:t-ops', factoryProjectId: 'fp-2' },
        { integrationId: 'jira', sourceId: 'j-10', factoryProjectId: 'fp-1' },
        { integrationId: 'jira', sourceId: 'j-11', factoryProjectId: 'fp-2' },
      ],
      linearProjects: [
        { id: 'lp-1', name: 'Billing', state: 'started', teams: [{ id: 't-eng', key: 'ENG', name: 'Eng' }] },
      ],
      linearTeams: [
        { id: 't-eng', key: 'eng', name: 'Eng' },
        { id: 't-ops', key: 'OPS', name: 'Ops' },
      ],
      jiraProjects: [
        { id: 'j-10', key: 'PLAT', name: 'Platform' },
        { id: 'j-11', key: 'OTHER', name: 'Other' },
      ],
    });
    expect(options).toEqual([
      { value: 'acme/app', provider: 'github' },
      { value: 'acme/platform/api', provider: 'gitlab' },
      { value: 'ENG', provider: 'linear' },
      { value: 'PLAT', provider: 'jira' },
    ]);
  });

  it('offers nothing before anything has loaded', () => {
    expect(sourceSuggestions({ factoryProjectId: 'fp-1' })).toEqual([]);
  });
});

describe('limitedProviders', () => {
  it('reads "is" and "is any of" on provider or integration, and keeps only what every limit allows', () => {
    expect(limitedProviders([{ field: 'source.provider', operator: 'equals', value: 'GitHub' }])).toEqual(
      new Set(['github']),
    );
    expect(
      limitedProviders([
        { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
        { field: 'source.provider', operator: 'equals', value: 'gitlab' },
      ]),
    ).toEqual(new Set(['gitlab']));
  });

  it('ignores conditions that leave the provider open', () => {
    expect(limitedProviders([{ field: 'source.provider', operator: 'not_equals', value: 'github' }])).toBeUndefined();
    expect(limitedProviders([{ field: 'item.labels', operator: 'equals', value: 'bug' }])).toBeUndefined();
  });
});

describe('narrowSuggestions', () => {
  const field = {
    id: 'source.repository',
    label: 'Repository, team or project',
    suggestions: [
      { value: 'acme/app', provider: 'github' },
      { value: 'ENG', provider: 'linear' },
    ],
  };

  it("keeps only the allowed providers' values", () => {
    const limits = [{ field: 'source.provider', operator: 'equals', value: 'linear' }];
    expect(narrowSuggestions(field, limits).suggestions).toEqual([{ value: 'ENG', provider: 'linear' }]);
  });

  it('leaves the field alone with no provider limit', () => {
    expect(narrowSuggestions(field, [])).toBe(field);
  });
});
