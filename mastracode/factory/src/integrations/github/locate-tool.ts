import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getFactoryAuthOrgId, getFactoryAuthUserFromContext } from '../../auth.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../../storage/domains/source-control/base.js';
import type { GithubIntegration } from './integration.js';

const MAX_REPOSITORIES_PER_SEARCH = 10;
const MAX_SEARCH_RESULTS = 30;
const MAX_PATH_PROBES = 5;

const locateInputSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe(
      'Words, identifiers, or a filename to search for in other factories’ repositories (GitHub code search syntax).',
    ),
  paths: z
    .array(z.string().min(1))
    .max(MAX_PATH_PROBES)
    .optional()
    .describe('Exact repository-relative paths to check for in every candidate repository.'),
});

export interface LocateMatch {
  path: string;
  url: string;
}

export interface LocatedRepository {
  slug: string;
  matches: LocateMatch[];
  searchable: boolean;
}

export interface LocatedFactory {
  factoryProjectId: string;
  name: string;
  repositories: LocatedRepository[];
}

export interface LocateResult {
  current: string;
  factories: LocatedFactory[];
}

export interface LocateCodeSearch {
  search(input: { q: string; perPage: number }): Promise<Array<{ repository: string; path: string; url: string }>>;
  pathExists(input: { slug: string; path: string }): Promise<{ exists: boolean; url?: string }>;
}

export interface LocateDeps {
  projects: Pick<FactoryProjectsStorage, 'list'>;
  sourceControl: Pick<
    SourceControlStorageHandle,
    'connections' | 'projectRepositories' | 'repositories' | 'installations'
  >;
  searchFor(installationExternalId: string): LocateCodeSearch;
}

interface CandidateRepository {
  factoryProjectId: string;
  factoryName: string;
  slug: string;
  installationExternalId: string;
}

async function listCandidateRepositories(
  deps: LocateDeps,
  orgId: string,
  currentFactoryProjectId: string,
): Promise<CandidateRepository[]> {
  const factories = (await deps.projects.list({ orgId })).filter(factory => factory.id !== currentFactoryProjectId);
  const installations = new Map(
    (await deps.sourceControl.installations.list({ orgId })).map(installation => [installation.id, installation]),
  );
  const candidates: CandidateRepository[] = [];
  for (const factory of factories) {
    const connections = await deps.sourceControl.connections.list({ orgId, factoryProjectId: factory.id });
    for (const connection of connections) {
      const installation = installations.get(connection.installationId);
      if (!installation) continue;
      const projectRepositories = await deps.sourceControl.projectRepositories.list({
        orgId,
        connectionId: connection.id,
      });
      for (const projectRepository of projectRepositories) {
        const repository = await deps.sourceControl.repositories.get({ orgId, id: projectRepository.repositoryId });
        if (!repository) continue;
        candidates.push({
          factoryProjectId: factory.id,
          factoryName: factory.name,
          slug: repository.slug,
          installationExternalId: installation.externalId,
        });
      }
    }
  }
  return candidates;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export async function locateAcrossFactories(
  deps: LocateDeps,
  input: { orgId: string; currentFactoryProjectId: string; query: string; paths?: string[] },
): Promise<LocateResult> {
  const candidates = await listCandidateRepositories(deps, input.orgId, input.currentFactoryProjectId);
  const bySlug = new Map(candidates.map(candidate => [candidate.slug.toLowerCase(), candidate]));
  const located = new Map<string, LocatedRepository>();
  const repositoryFor = (candidate: CandidateRepository) => {
    const key = candidate.slug.toLowerCase();
    let repository = located.get(key);
    if (!repository) {
      repository = { slug: candidate.slug, matches: [], searchable: true };
      located.set(key, repository);
    }
    return repository;
  };
  const addMatch = (candidate: CandidateRepository, match: LocateMatch) => {
    const repository = repositoryFor(candidate);
    if (!repository.matches.some(existing => existing.path === match.path)) repository.matches.push(match);
  };

  const byInstallation = new Map<string, CandidateRepository[]>();
  for (const candidate of candidates) {
    const group = byInstallation.get(candidate.installationExternalId) ?? [];
    group.push(candidate);
    byInstallation.set(candidate.installationExternalId, group);
  }

  for (const [installationExternalId, group] of byInstallation) {
    const search = deps.searchFor(installationExternalId);
    for (const batch of chunk(group, MAX_REPOSITORIES_PER_SEARCH)) {
      const q = `${input.query} ${batch.map(candidate => `repo:${candidate.slug}`).join(' ')}`;
      try {
        const results = await search.search({ q, perPage: MAX_SEARCH_RESULTS });
        for (const result of results) {
          const candidate = bySlug.get(result.repository.toLowerCase());
          if (candidate) addMatch(candidate, { path: result.path, url: result.url });
        }
      } catch (error) {
        console.warn('[factory_locate] code search failed', { installationExternalId, error });
        for (const candidate of batch) repositoryFor(candidate).searchable = false;
      }
      for (const path of input.paths ?? []) {
        for (const candidate of batch) {
          let probe: { exists: boolean; url?: string };
          try {
            probe = await search.pathExists({ slug: candidate.slug, path });
          } catch (error) {
            // pathExists only returns `exists: false` for a 404. Anything else
            // is the API being unavailable, which is the partial-failure the
            // `searchable` flag exists for — reporting it as a missing path
            // would drop the repository (and its factory) from the result.
            console.warn('[factory_locate] path probe failed', {
              installationExternalId,
              slug: candidate.slug,
              path,
              error,
            });
            repositoryFor(candidate).searchable = false;
            continue;
          }
          if (probe.exists) {
            addMatch(candidate, { path, url: probe.url ?? `https://github.com/${candidate.slug}/blob/HEAD/${path}` });
          }
        }
      }
    }
  }

  const factories = new Map<string, LocatedFactory>();
  for (const candidate of candidates) {
    const repository = located.get(candidate.slug.toLowerCase());
    if (!repository) continue;
    let factory = factories.get(candidate.factoryProjectId);
    if (!factory) {
      factory = { factoryProjectId: candidate.factoryProjectId, name: candidate.factoryName, repositories: [] };
      factories.set(candidate.factoryProjectId, factory);
    }
    if (!factory.repositories.includes(repository)) factory.repositories.push(repository);
  }
  return {
    current: input.currentFactoryProjectId,
    factories: [...factories.values()].filter(factory =>
      factory.repositories.some(repository => repository.matches.length > 0 || !repository.searchable),
    ),
  };
}

export function githubCodeSearch(github: Pick<GithubIntegration, 'getInstallationOctokit'>): LocateDeps['searchFor'] {
  return installationExternalId => {
    const octokit = github.getInstallationOctokit(Number.parseInt(installationExternalId, 10));
    return {
      search: async ({ q, perPage }) => {
        const { data } = await octokit.rest.search.code({ q, per_page: perPage });
        return data.items.map(item => ({ repository: item.repository.full_name, path: item.path, url: item.html_url }));
      },
      pathExists: async ({ slug, path }) => {
        const [owner, repo] = slug.split('/');
        try {
          const { data } = await octokit.rest.repos.getContent({ owner: owner!, repo: repo!, path });
          const probe: { exists: boolean; url?: string } = { exists: true };
          if (!Array.isArray(data) && data.html_url) probe.url = data.html_url;
          return probe;
        } catch (error) {
          if ((error as { status?: number }).status === 404) return { exists: false };
          throw error;
        }
      },
    };
  };
}

type FactorySessionState = { factoryProjectId?: string };

function currentFactoryProjectId(requestContext: RequestContext): string | undefined {
  const controller = requestContext.get('controller') as AgentControllerRequestContext<FactorySessionState> | undefined;
  return controller?.getState().factoryProjectId;
}

export function createFactoryLocateTool(
  requestContext: RequestContext,
  github: Pick<GithubIntegration, 'getInstallationOctokit' | 'sourceControlStorage' | 'projectsStorage'>,
) {
  const orgId = getFactoryAuthOrgId(getFactoryAuthUserFromContext(requestContext));
  const factoryProjectId = currentFactoryProjectId(requestContext);
  if (!orgId || !factoryProjectId) return {};

  return {
    factory_locate: createTool({
      id: 'factory_locate',
      description:
        'Search the repositories of the other factories in this organization for code, files, or terms that are not in the current repository. Use it after looking locally and finding nothing. Returns matches grouped by factory so you can ask the person whether to continue the work in that factory with factory_handoff.',
      inputSchema: locateInputSchema,
      execute: async input =>
        locateAcrossFactories(
          {
            projects: github.projectsStorage,
            sourceControl: github.sourceControlStorage,
            searchFor: githubCodeSearch(github),
          },
          { orgId, currentFactoryProjectId: factoryProjectId, ...input },
        ),
    }),
  };
}
