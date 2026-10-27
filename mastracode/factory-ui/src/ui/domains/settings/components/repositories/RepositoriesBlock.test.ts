import { describe, expect, it } from 'vitest';

import { environmentRepository } from '../__tests__/fixtures/environment';
import { reorderPatch } from './RepositoriesBlock';

describe('reorderPatch', () => {
  const web = environmentRepository({ projectRepositoryId: 'link-web', position: 1 });
  const api = environmentRepository({ projectRepositoryId: 'link-api', position: 2, setupCommand: 'pnpm build' });
  const gone = environmentRepository({
    projectRepositoryId: 'link-gone',
    slug: null,
    position: 3,
    inEnvironment: false,
  });

  it('renumbers every link 1..n in display order, dead ones included, and sends nothing but positions', () => {
    expect(reorderPatch([api, web, gone])).toEqual([
      { projectRepositoryId: 'link-api', position: 1 },
      { projectRepositoryId: 'link-web', position: 2 },
      { projectRepositoryId: 'link-gone', position: 3 },
    ]);
  });
});
