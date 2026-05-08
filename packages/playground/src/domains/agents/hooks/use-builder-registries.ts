import type {
  BuilderRegistryInstallBody,
  BuilderRegistryInstallResponse,
  BuilderRegistryPopularResponse,
  BuilderRegistryPreviewResponse,
  BuilderRegistrySearchResponse,
  ListBuilderRegistriesResponse,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// =============================================================================
// Builder skill registry hooks
//
// Wrap the `/editor/builder/registries/*` routes with React Query. The registry
// surface is hard-gated server-side, so callers can rely on errors (404) rather
// than guessing whether a registry is enabled.
// =============================================================================

const STALE_POPULAR_MS = 5 * 60 * 1000;

/**
 * List known builder skill registries with their enabled state.
 */
export function useBuilderRegistries(options?: { enabled?: boolean }) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['builder-registries'],
    queryFn: (): Promise<ListBuilderRegistriesResponse> => client.listBuilderRegistries(),
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

/**
 * Run a free-text search against a builder skill registry. The mutation
 * shape mirrors the existing skills.sh hook so the dialog can call it on
 * submit.
 */
export function useSearchBuilderRegistry(registryId: string | undefined) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async (query: string): Promise<BuilderRegistrySearchResponse> => {
      if (!registryId) throw new Error('Registry ID is required');
      return client.searchBuilderRegistry(registryId, { q: query, limit: 10 });
    },
  });
}

/**
 * Fetch the popular skills feed for a registry. Cached for 5 minutes so
 * navigating in and out of the dialog doesn't refetch.
 */
export function usePopularBuilderRegistrySkills(registryId: string | undefined) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['builder-registry', registryId, 'popular'],
    queryFn: (): Promise<BuilderRegistryPopularResponse> => {
      if (!registryId) throw new Error('Registry ID is required');
      return client.getBuilderRegistryPopular(registryId, { limit: 10, offset: 0 });
    },
    enabled: !!registryId,
    staleTime: STALE_POPULAR_MS,
    retry: false,
  });
}

/**
 * Fetch the rendered preview for a single registry skill.
 */
export function useBuilderRegistryPreview(
  registryId: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  skillPath: string | undefined,
  options?: { enabled?: boolean },
) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['builder-registry', registryId, 'preview', owner, repo, skillPath],
    queryFn: async (): Promise<string> => {
      if (!registryId || !owner || !repo || !skillPath) {
        throw new Error('registryId, owner, repo, and skillPath are required');
      }
      const data: BuilderRegistryPreviewResponse = await client.getBuilderRegistryPreview(registryId, {
        owner,
        repo,
        path: skillPath,
      });
      return data.content;
    },
    enabled: options?.enabled !== false && !!registryId && !!owner && !!repo && !!skillPath,
    retry: false,
  });
}

/**
 * Install a skill from a builder registry into the stored-skills DB.
 * Returns 409 when a stored skill with the derived id already exists — the
 * UI is responsible for surfacing the existing skill via "Open existing".
 */
export function useInstallBuilderRegistrySkill(registryId: string | undefined) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BuilderRegistryInstallBody): Promise<BuilderRegistryInstallResponse> => {
      if (!registryId) throw new Error('Registry ID is required');
      return client.installBuilderRegistrySkill(registryId, body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-skills'] });
    },
  });
}
