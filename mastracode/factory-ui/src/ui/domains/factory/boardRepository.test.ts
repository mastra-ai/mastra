import { describe, expect, it } from 'vitest';

import { environmentRepository } from '../settings/components/__tests__/fixtures/environment';
import type { LinkedRepositoryPayload } from '../workspaces/services/github';
import { providerFactsCard } from '../../__tests__/fixtures/providerFactsCard';
import {
  cardProjectRepositoryId,
  cardRepositorySlug,
  cardSessionRepository,
  firstEnvironmentRepository,
} from './boardRepository';
import type { CardSessionRepository } from './boardRepository';

function repository(provider: 'github' | 'gitlab', externalId: string, slug: string): LinkedRepositoryPayload {
  return {
    projectRepositoryId: slug,
    provider,
    externalId,
    slug,
    gitBranch: 'main',
  };
}

describe('cardRepositorySlug', () => {
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

describe('cardSessionRepository', () => {
  const resolvedSlug = (result: CardSessionRepository) =>
    result.kind === 'resolved' ? result.repository.slug : result.kind;

  it.each(['github', 'gitlab'] as const)('starts a renamed %s repository card by its provider id', provider => {
    const card = {
      source: `${provider}-issue`,
      metadata: { repository: 'acme/old-name', githubRepositoryId: 202, gitlabProjectId: '202' },
      workItem: { metadata: provider === 'github' ? { githubRepositoryId: 101 } : { gitlabProjectId: '101' } },
    };
    const repositories = [repository(provider, '202', 'acme/other'), repository(provider, '101', 'acme/renamed')];

    expect(resolvedSlug(cardSessionRepository(repositories, card, undefined))).toBe('acme/renamed');
  });

  describe.each(['github-issue', 'github-pr', 'gitlab-issue', 'gitlab-pr'])('a %s card', source => {
    const provider = source.startsWith('github-') ? 'github' : 'gitlab';
    const otherProvider = provider === 'github' ? 'gitlab' : 'github';
    const ids = { githubRepositoryId: 101, gitlabProjectId: '101' };

    it.each([
      ['the sole repository', ids],
      ['a stored slug', { ...ids, repository: 'acme/other' }],
    ])('never starts in the other provider through %s', (_label, metadata) => {
      const result = cardSessionRepository(
        [repository(otherProvider, '101', 'acme/other')],
        { source, metadata },
        undefined,
      );

      expect(result.kind).toBe('unavailable');
    });

    it('picks its own provider when linked repositories share a slug', () => {
      const repositories = [
        repository(otherProvider, '101', 'acme/shared'),
        repository(provider, '101', 'acme/shared'),
      ];
      const result = cardSessionRepository(repositories, { source, metadata: ids }, undefined);

      expect(result.kind === 'resolved' && result.repository.provider).toBe(provider);
    });

    it('starts in the only repository of its provider without metadata', () => {
      const repositories = [repository(otherProvider, '202', 'acme/other'), repository(provider, '101', 'acme/source')];

      expect(resolvedSlug(cardSessionRepository(repositories, { source }, undefined))).toBe('acme/source');
    });

    it('starts in the stored slug when only the other provider id matches', () => {
      const repositories = [repository(otherProvider, '101', 'acme/other'), repository(provider, '999', 'acme/target')];
      const card = { source, metadata: { ...ids, repository: 'acme/target' } };

      expect(resolvedSlug(cardSessionRepository(repositories, card, undefined))).toBe('acme/target');
    });
  });

  it.each(['linear-issue', 'manual'])('starts a %s card in the sole repository', source => {
    expect(resolvedSlug(cardSessionRepository([repository('gitlab', '101', 'acme/one')], { source }, undefined))).toBe(
      'acme/one',
    );
  });

  it("starts a Linear card in its project's configured repository", () => {
    const repositories = [repository('github', '101', 'acme/app'), repository('github', '202', 'acme/other')];
    const off = { enabled: false, sourceIds: null };
    const config = {
      github: off,
      gitlab: off,
      jira: off,
      incidentio: off,
      linear: {
        enabled: true,
        sourceIds: ['linear-project-1'],
        repositoryByLinearProject: { 'linear-project-1': 'acme/other' },
      },
    };
    const card = { source: 'linear-issue', metadata: { linearProjectId: 'linear-project-1' } };

    expect(resolvedSlug(cardSessionRepository(repositories, card, config))).toBe('acme/other');
  });

  it('leaves the choice to the environment when several could hold a card that names none', () => {
    const repositories = [repository('github', '101', 'acme/one'), repository('gitlab', '202', 'acme/two')];
    const result = cardSessionRepository(repositories, { source: 'manual' }, undefined);

    expect(result.kind === 'firstInEnvironment' && result.candidates.map(candidate => candidate.slug)).toEqual([
      'acme/one',
      'acme/two',
    ]);
  });

  it('refuses a stored slug that is not linked', () => {
    const result = cardSessionRepository(
      [repository('github', '101', 'acme/one')],
      { source: 'manual', metadata: { repository: 'acme/gone' } },
      undefined,
    );

    expect(result.kind).toBe('unavailable');
  });
});

describe('firstEnvironmentRepository', () => {
  const candidates = [
    repository('github', '101', 'acme/one'),
    repository('github', '202', 'acme/two'),
    repository('github', '303', 'acme/three'),
  ];

  it('picks the candidate first in the environment, skipping repositories left out of it', () => {
    const environment = [
      environmentRepository({ projectRepositoryId: 'acme/elsewhere', position: 0 }),
      environmentRepository({ projectRepositoryId: 'acme/one', position: 1, inEnvironment: false }),
      environmentRepository({ projectRepositoryId: 'acme/two', position: 3 }),
      environmentRepository({ projectRepositoryId: 'acme/three', position: 2 }),
    ];

    expect(firstEnvironmentRepository(candidates, environment)?.slug).toBe('acme/three');
  });

  it('finds none when no candidate is in the environment', () => {
    const environment = [environmentRepository({ projectRepositoryId: 'acme/one', inEnvironment: false })];

    expect(firstEnvironmentRepository(candidates, environment)).toBeUndefined();
  });
});
