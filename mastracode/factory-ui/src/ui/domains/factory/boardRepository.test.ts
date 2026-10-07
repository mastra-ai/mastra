import { describe, expect, it } from 'vitest';

import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import { cardRepositorySlug } from './boardRepository';

function repository(provider: 'github' | 'gitlab', externalId: string, slug: string): LinkedRepositoryPayload {
  return {
    projectRepositoryId: slug,
    provider,
    externalId,
    slug,
    gitBranch: 'main',
    sandboxWorkdir: `/sandbox/${slug}`,
  };
}

describe('cardRepositorySlug', () => {
  it('matches a provider id only against repositories from the same provider', () => {
    const gitlabRepository = repository('gitlab', '101', 'acme/gitlab');
    const repositories = [gitlabRepository, repository('github', '101', 'acme/github')];

    expect(
      cardRepositorySlug('github-issue', { repository: 'acme/old', githubRepositoryId: 101 }, undefined, repositories),
    ).toBe('acme/github');
    expect(
      cardRepositorySlug('gitlab-issue', { repository: 'acme/old', gitlabProjectId: '101' }, undefined, repositories),
    ).toBe('acme/gitlab');
    expect(
      cardRepositorySlug('github-issue', { repository: 'acme/old', githubRepositoryId: 101 }, undefined, [
        gitlabRepository,
      ]),
    ).toBe('acme/old');
  });

  it('falls back to the stored slug when the provider id matches multiple repositories', () => {
    const repositories = [repository('github', '101', 'acme/one'), repository('github', '101', 'acme/two')];

    expect(
      cardRepositorySlug(
        'github-issue',
        { repository: 'acme/stored', githubRepositoryId: 101 },
        undefined,
        repositories,
      ),
    ).toBe('acme/stored');
    expect(cardRepositorySlug('github-issue', { githubRepositoryId: 101 }, undefined, repositories)).toBeUndefined();
  });

  it('treats an unspecified provider as GitHub and preserves zero-valued ids', () => {
    const repositories = [{ ...repository('github', '0', 'acme/renamed'), provider: undefined }];

    expect(
      cardRepositorySlug('github-issue', { repository: 'acme/old', githubRepositoryId: 0 }, undefined, repositories),
    ).toBe('acme/renamed');
    expect(cardRepositorySlug('github-issue', undefined, undefined, repositories)).toBeUndefined();
  });
});
