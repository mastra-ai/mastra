import { describe, expect, it } from 'vitest';

import { environmentRepository } from '../__tests__/fixtures/environment';
import { repositoriesPatch } from './RepositoriesBlock';

describe('repositoriesPatch', () => {
  const web = environmentRepository({ projectRepositoryId: 'link-web', position: 1 });
  const api = environmentRepository({ projectRepositoryId: 'link-api', position: 2, setupCommand: 'pnpm build' });
  const gone = environmentRepository({
    projectRepositoryId: 'link-gone',
    slug: null,
    position: 3,
    inEnvironment: false,
  });

  it('renumbers positions 1..n in display order and keeps every link, dead ones included', () => {
    // The page lists the live rows first (here dropped in a new order) and appends the dead links.
    expect(repositoriesPatch([api, web, gone])).toEqual([
      {
        projectRepositoryId: 'link-api',
        position: 1,
        inEnvironment: true,
        setupCommand: 'pnpm build',
        teardownCommand: null,
      },
      { projectRepositoryId: 'link-web', position: 2, inEnvironment: true, setupCommand: null, teardownCommand: null },
      {
        projectRepositoryId: 'link-gone',
        position: 3,
        inEnvironment: false,
        setupCommand: null,
        teardownCommand: null,
      },
    ]);
  });

  it('applies one change on top of the stored values', () => {
    const patch = repositoriesPatch([web, api, gone], { projectRepositoryId: 'link-api', inEnvironment: false });
    expect(patch[1]).toMatchObject({
      projectRepositoryId: 'link-api',
      position: 2,
      inEnvironment: false,
      setupCommand: 'pnpm build',
    });
    expect(patch[0]).toMatchObject({ projectRepositoryId: 'link-web', inEnvironment: true });
  });
});
