import { describe, expect, it } from 'vitest';

import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import { providerFactsCard } from '../../__tests__/fixtures/providerFactsCard';
import { cardProjectRepositoryId } from './boardRepository';

function repository(provider: 'github' | 'gitlab', externalId: string, slug: string): LinkedRepositoryPayload {
  return {
    projectRepositoryId: slug,
    provider,
    externalId,
    slug,
    gitBranch: 'main',
  };
}

describe('cardProjectRepositoryId', () => {
  it.each(['github', 'gitlab'] as const)('locates a %s card repository using normalized provider ids', provider => {
    const card = {
      source: `${provider}-issue`,
      metadata: { githubRepositoryId: 202, gitlabProjectId: '202', repository: 'acme/old' },
      workItem: {
        ...providerFactsCard.workItem,
        metadata: provider === 'github' ? { githubRepositoryId: 101 } : { gitlabProjectId: '101' },
      },
    };
    expect(
      cardProjectRepositoryId(
        [repository(provider, '101', 'acme/current'), repository(provider, '202', 'acme/stale')],
        card,
        'fallback',
      ),
    ).toBe('acme/current');
  });

  it.each(['github-issue', 'github-pr', 'gitlab-issue', 'gitlab-pr'])(
    'uses the %s source provider when both ids match linked repositories',
    source => {
      const provider = source.startsWith('github-') ? 'github' : 'gitlab';
      const card = { source, metadata: { githubRepositoryId: 101, gitlabProjectId: '202' } };
      const repositories = [repository('gitlab', '202', 'acme/gitlab'), repository('github', '101', 'acme/github')];

      expect(cardProjectRepositoryId(repositories, card, undefined)).toBe(`acme/${provider}`);
    },
  );

  it('falls back when the provider id matches multiple repositories', () => {
    const repositories = [repository('github', '101', 'acme/one'), repository('github', '101', 'acme/two')];

    expect(
      cardProjectRepositoryId(repositories, { source: 'github-issue', metadata: { githubRepositoryId: 101 } }, 'none'),
    ).toBe('none');
  });

  it('treats an unspecified provider as GitHub and preserves zero-valued ids', () => {
    const repositories = [{ ...repository('github', '0', 'acme/renamed'), provider: undefined }];

    expect(
      cardProjectRepositoryId(repositories, { source: 'github-issue', metadata: { githubRepositoryId: 0 } }, undefined),
    ).toBe('acme/renamed');
  });
});
