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
    const repositories = [repository('gitlab', '101', 'acme/gitlab'), repository('github', '101', 'acme/github')];

    expect(
      cardRepositorySlug('github-issue', { repository: 'acme/old', githubRepositoryId: 101 }, undefined, repositories),
    ).toBe('acme/github');
    expect(
      cardRepositorySlug('gitlab-issue', { repository: 'acme/old', gitlabProjectId: '101' }, undefined, repositories),
    ).toBe('acme/gitlab');
    expect(
      cardRepositorySlug('github-issue', { repository: 'acme/old', githubRepositoryId: 101 }, undefined, [
        repositories[0]!,
      ]),
    ).toBe('acme/old');
  });
});
