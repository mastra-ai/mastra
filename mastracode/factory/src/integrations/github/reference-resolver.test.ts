import { describe, expect, it, vi } from 'vitest';

import { createGithubReferenceResolver, extractGithubRepositorySlugs } from './reference-resolver.js';

describe('extractGithubRepositorySlugs', () => {
  it('finds repository slugs in issue, pull request, and bare repository urls', () => {
    expect(
      extractGithubRepositorySlugs(
        'see https://github.com/Acme/App/issues/12 and <https://github.com/acme/app/pull/3|PR> plus https://github.com/acme/api.git and http://www.github.com/acme/docs',
      ),
    ).toEqual(['acme/app', 'acme/api', 'acme/docs']);
  });

  it('keeps sentence punctuation out of the slug', () => {
    expect(
      extractGithubRepositorySlugs('look at https://github.com/acme/app, then https://github.com/acme/api.'),
    ).toEqual(['acme/app', 'acme/api']);
  });

  it('keeps a dot that belongs to the repository name', () => {
    expect(extractGithubRepositorySlugs('https://github.com/acme/tool.js')).toEqual(['acme/tool.js']);
  });

  it('ignores non-repository github urls', () => {
    expect(extractGithubRepositorySlugs('https://github.com/acme https://gist.github.com/x/y')).toEqual([]);
  });
});

describe('createGithubReferenceResolver', () => {
  function makeSourceControl() {
    return {
      installations: {
        list: vi.fn().mockResolvedValue([{ id: 'inst-1', externalId: '100' }]),
      },
      repositories: {
        list: vi.fn().mockResolvedValue([
          { id: 'repo-1', externalId: '1', slug: 'Acme/App' },
          { id: 'repo-2', externalId: '2', slug: 'acme/api' },
        ]),
      },
      projectRepositories: {
        listByExternalRepository: vi.fn(async ({ repositoryExternalId }: { repositoryExternalId: string }) =>
          repositoryExternalId === '1'
            ? [
                { orgId: 'org-1', factoryProjectId: 'fp-app', projectRepository: {} },
                { orgId: 'org-2', factoryProjectId: 'fp-foreign', projectRepository: {} },
              ]
            : [],
        ),
      },
    } as any;
  }

  it('maps a repository url to the factories linked to it within the org', async () => {
    const sourceControl = makeSourceControl();
    const resolve = createGithubReferenceResolver({ sourceControl });

    await expect(
      resolve({ orgId: 'org-1', text: 'fix https://github.com/acme/app/issues/12 and https://github.com/acme/api' }),
    ).resolves.toEqual([{ reference: 'acme/app', factoryProjectId: 'fp-app' }]);
    expect(sourceControl.repositories.list).toHaveBeenCalledWith({ orgId: 'org-1', installationId: 'inst-1' });
    expect(sourceControl.projectRepositories.listByExternalRepository).toHaveBeenCalledWith({
      installationExternalId: '100',
      repositoryExternalId: '1',
    });
  });

  it('does not read storage when the text has no repository urls', async () => {
    const sourceControl = makeSourceControl();
    const resolve = createGithubReferenceResolver({ sourceControl });
    await expect(resolve({ orgId: 'org-1', text: 'plain text' })).resolves.toEqual([]);
    expect(sourceControl.installations.list).not.toHaveBeenCalled();
  });
});
