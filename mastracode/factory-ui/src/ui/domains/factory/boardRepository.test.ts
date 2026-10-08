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
  describe.each(['github-issue', 'github-pr', 'gitlab-issue', 'gitlab-pr'])('%s with both provider ids', source => {
    const provider = source.startsWith('github-') ? 'github' : 'gitlab';
    const metadata = { repository: 'acme/stored', githubRepositoryId: 101, gitlabProjectId: '202' };

    it('uses the source provider when both ids match linked repositories', () => {
      const repositories = [repository('gitlab', '202', 'acme/gitlab'), repository('github', '101', 'acme/github')];

      expect(cardRepositorySlug(source, metadata, undefined, repositories)).toBe(`acme/${provider}`);
    });

    it('falls back to the stored slug when only the other provider id matches', () => {
      const otherProvider = provider === 'github' ? 'gitlab' : 'github';
      const repositories = [repository(otherProvider, otherProvider === 'github' ? '101' : '202', 'acme/other')];

      expect(cardRepositorySlug(source, metadata, undefined, repositories)).toBe('acme/stored');
      expect(
        cardRepositorySlug(source, { githubRepositoryId: 101, gitlabProjectId: '202' }, undefined, repositories),
      ).toBeUndefined();
    });

    it('ignores the other provider id when the source provider id is missing', () => {
      const otherProvider = provider === 'github' ? 'gitlab' : 'github';
      const otherId = provider === 'github' ? { gitlabProjectId: '101' } : { githubRepositoryId: 101 };

      expect(
        cardRepositorySlug(source, otherId, undefined, [repository(otherProvider, '101', 'acme/other')]),
      ).toBeUndefined();
    });
  });

  it.each(['linear-issue', 'manual'])('preserves stable-id lookup for %s cards', source => {
    expect(
      cardRepositorySlug(source, { gitlabProjectId: '101' }, undefined, [repository('gitlab', '101', 'acme/gitlab')]),
    ).toBe('acme/gitlab');
  });

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
