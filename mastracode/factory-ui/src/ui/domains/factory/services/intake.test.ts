import { describe, expect, it } from 'vitest';

import { mappedRepositorySlug } from './intake';

const config = {
  linear: { enabled: true, sourceIds: ['lproj-1'], repositoryByLinearProject: { 'lproj-1': 'acme/linear' } },
  jira: {
    enabled: true,
    sourceIds: ['10001'],
    repositoryByJiraProject: { '10001': 'acme/web' },
    repositoryByJiraComponent: { '10001': { 'Mobile App': 'acme/mobile' } },
  },
};

describe('mappedRepositorySlug', () => {
  it('maps Linear cards by project', () => {
    expect(mappedRepositorySlug('linear-issue', { linearProjectId: 'lproj-1' }, config)).toBe('acme/linear');
    expect(mappedRepositorySlug('linear-issue', { linearProjectId: 'lproj-2' }, config)).toBeUndefined();
  });

  it('maps Jira cards by routed component first, then by project', () => {
    expect(
      mappedRepositorySlug('jira-issue', { jiraSourceId: '10001', components: ['Docs', 'mobile app'] }, config),
    ).toBe('acme/mobile');
    expect(mappedRepositorySlug('jira-issue', { jiraSourceId: '10001', components: ['Docs'] }, config)).toBe(
      'acme/web',
    );
    expect(
      mappedRepositorySlug('jira-issue', { jiraSourceId: '10002', components: ['Mobile App'] }, config),
    ).toBeUndefined();
  });

  it('ignores cards from other providers, cards without a source id, and missing config', () => {
    expect(mappedRepositorySlug('github-issue', { jiraSourceId: '10001' }, config)).toBeUndefined();
    expect(mappedRepositorySlug('jira-issue', { components: ['Mobile App'] }, config)).toBeUndefined();
    expect(mappedRepositorySlug('jira-issue', { jiraSourceId: '10001' }, undefined)).toBeUndefined();
    expect(mappedRepositorySlug('jira-issue', null, config)).toBeUndefined();
  });
});
