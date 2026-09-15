import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { FactoryReferenceResolver, ReferencedFactoryProject } from '../base.js';

const MAX_REFERENCES_PER_MESSAGE = 5;
const REPOSITORY_URL_RE =
  /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?=[/?#\s>|)]|$)/g;

export function extractGithubRepositorySlugs(text: string): string[] {
  const slugs = new Set<string>();
  for (const match of text.matchAll(REPOSITORY_URL_RE)) {
    slugs.add(`${match[1]}/${match[2]}`.toLowerCase());
  }
  return [...slugs].slice(0, MAX_REFERENCES_PER_MESSAGE);
}

export function createGithubReferenceResolver({
  sourceControl,
}: {
  sourceControl: Pick<SourceControlStorageHandle, 'installations' | 'repositories' | 'projectRepositories'>;
}): FactoryReferenceResolver {
  return async ({ orgId, text }) => {
    const slugs = extractGithubRepositorySlugs(text);
    if (slugs.length === 0) return [];

    const installations = await sourceControl.installations.list({ orgId });
    if (installations.length === 0) return [];

    const referenced: ReferencedFactoryProject[] = [];
    for (const installation of installations) {
      const repositories = await sourceControl.repositories.list({ orgId, installationId: installation.id });
      for (const repository of repositories) {
        const slug = repository.slug.toLowerCase();
        if (!slugs.includes(slug)) continue;
        const targets = await sourceControl.projectRepositories.listByExternalRepository({
          installationExternalId: installation.externalId,
          repositoryExternalId: repository.externalId,
        });
        for (const target of targets) {
          if (target.orgId !== orgId) continue;
          referenced.push({ reference: slug, factoryProjectId: target.factoryProjectId });
        }
      }
    }
    return referenced;
  };
}
