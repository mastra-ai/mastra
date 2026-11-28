import type {
  CredentialWriteScope,
  FactoryRequestError,
  ModelCatalogTarget,
  ModelPackSet,
  ModelSelectionRequest,
  SessionModelTarget,
  WorkspaceChangesScope,
} from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useFactoryWeb } from './context';
import { factoryWebKeys } from './web-keys';

function invalidateCredentialDependents(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: factoryWebKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() }),
    queryClient.invalidateQueries({ queryKey: factoryWebKeys.voiceSettingsAll() }),
  ]);
}

// Model config

export function useDefaultModelQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.defaultModel(),
    queryFn: ({ signal }) => web.defaultModel({ signal }),
    enabled,
  });
}

export function useSetDefaultModel() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation<{ ok: true; modelId: string }, FactoryRequestError, string>({
    mutationFn: modelId => web.setDefaultModel(modelId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: factoryWebKeys.defaultModel() }),
        queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() }),
      ]),
  });
}

export function useSetPersonalModelPacks() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (set: ModelPackSet) => web.setModelPacks(set),
    onSuccess: saved => {
      queryClient.setQueryData(factoryWebKeys.defaultModel(), saved);
      return queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() });
    },
  });
}

function catalogKeyFilter(target: ModelCatalogTarget) {
  if ('scope' in target) return { scope: target.scope };
  if ('factoryProjectId' in target) return { factoryProjectId: target.factoryProjectId };
  return undefined;
}

/** Settings catalogs use the Factory's scope or the caller's own personal credentials. */
export function useModelCatalogQuery(target: ModelCatalogTarget = {}, { enabled = true }: { enabled?: boolean } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.availableModels(catalogKeyFilter(target)),
    queryFn: ({ signal }) => web.models(target, { signal }),
    enabled,
  });
}

export function useSessionModelCatalogQuery(
  target: (SessionModelTarget & { factoryProjectId?: string; enabled?: boolean }) | undefined,
) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.availableModels({
      factoryProjectId: target?.factoryProjectId,
      sessionId: target?.sessionId,
      resourceId: target?.resourceId,
      threadId: target?.threadId,
    }),
    queryFn: target
      ? ({ signal }) =>
          web.sessionModels(
            { sessionId: target.sessionId, resourceId: target.resourceId, threadId: target.threadId },
            { signal },
          )
      : skipToken,
    enabled: target !== undefined && target.enabled !== false,
  });
}

/** `onSaved` lets the host refresh its own runtime state (the agent's settings) after a switch. */
export function useSetSessionModelMutation(
  target: SessionModelTarget,
  { onSaved }: { onSaved?: () => Promise<unknown> | void } = {},
) {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['session-model', target.sessionId],
    mutationFn: (selection: ModelSelectionRequest) => web.setSessionModel(target, selection),
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() }), onSaved?.()]),
  });
}

// Provider credentials

export function useProvidersQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.providers(),
    queryFn: ({ signal }) => web.providers({ signal }),
    enabled,
  });
}

export function useMastraGatewayCreditsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.mastraGatewayCredits(),
    queryFn: ({ signal }) => web.providerCredits('MASTRA_GATEWAY', { signal }),
    enabled,
  });
}

export function useProviderCredentialWrites() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  const onSuccess = () => invalidateCredentialDependents(queryClient);
  return {
    saveKey: useMutation({
      mutationFn: ({
        provider,
        ...body
      }: {
        provider: string;
        key: string;
        envVar?: string;
        scope?: CredentialWriteScope;
      }) => web.saveProviderKey(provider, body),
      onSuccess,
    }),
    removeKey: useMutation({
      mutationFn: ({ provider, scope }: { provider: string; scope?: CredentialWriteScope }) =>
        web.removeProviderKey(provider, scope),
      onSuccess,
    }),
    connect: useMutation({
      mutationFn: ({ provider, scope }: { provider: string; scope?: CredentialWriteScope }) =>
        web.connectProvider(provider, scope),
      onSuccess: () =>
        Promise.all([onSuccess(), queryClient.invalidateQueries({ queryKey: factoryWebKeys.mastraGatewayCredits() })]),
    }),
    startOAuth: useMutation({
      mutationFn: ({ provider, ...body }: { provider: string; mode?: string; scope?: CredentialWriteScope }) =>
        web.startProviderOAuth(provider, body),
    }),
    completeOAuth: useMutation({
      mutationFn: ({ provider, ...body }: { provider: string; sessionId: string; code: string }) =>
        web.completeProviderOAuth(provider, body),
      onSuccess,
    }),
    cancelOAuth: useMutation({
      mutationFn: ({ provider, sessionId }: { provider: string; sessionId: string }) =>
        web.cancelProviderOAuth(provider, sessionId),
    }),
    signOut: useMutation({
      mutationFn: ({ provider, scope }: { provider: string; scope?: CredentialWriteScope }) =>
        web.signOutProviderOAuth(provider, scope),
      onSuccess,
    }),
  };
}

// Voice

export function useVoiceSettings(factoryProjectId: string) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.voiceSettings(factoryProjectId),
    queryFn: ({ signal }) => web.voiceSettings(factoryProjectId, { signal }),
  });
}

/**
 * Saves the voice model; `null` goes back to auto. Other Factories refetch because a personal
 * choice is shared across them.
 */
export function useUpdateVoiceSettings(factoryProjectId: string) {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: { provider: string; model: string } | null) =>
      web.setVoiceSettings(factoryProjectId, choice ?? { provider: null }),
    onSuccess: res => {
      queryClient.setQueryData(factoryWebKeys.voiceSettings(factoryProjectId), res);
      void queryClient.invalidateQueries({
        queryKey: factoryWebKeys.voiceSettingsAll(),
        predicate: query => query.queryKey[1] !== factoryProjectId,
      });
    },
  });
}

// Workspace files

export function useDirectoryListing(path: string | undefined, { enabled = true }: { enabled?: boolean } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.fsList(path),
    queryFn: ({ signal }) => web.directory(path, { signal }),
    enabled,
  });
}

export function useArtifactsListing(path: string | undefined) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.artifactsList(path),
    queryFn: path ? ({ signal }) => web.artifacts(path, { signal }) : skipToken,
  });
}

export function useWorkspaceRendered(workspacePath: string | undefined, root: string | undefined) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceRenderedList(workspacePath, root),
    queryFn: workspacePath && root ? ({ signal }) => web.workspaceRendered(workspacePath, root, { signal }) : skipToken,
  });
}

export function useWorkspaceTree(workspacePath: string | undefined, path: string, { enabled = true } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceTree(workspacePath, path),
    queryFn: workspacePath ? ({ signal }) => web.workspaceTree(workspacePath, path, { signal }) : skipToken,
    enabled,
  });
}

export function useWorkspaceFileIndex(workspacePath: string | undefined, { enabled = true } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceFileIndex(workspacePath),
    queryFn: workspacePath ? ({ signal }) => web.workspaceFiles(workspacePath, { signal }) : skipToken,
    enabled,
  });
}

export function useWorkspaceFile(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true } = {},
) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceFile(workspacePath, filePath),
    queryFn:
      workspacePath && filePath ? ({ signal }) => web.workspaceFile(workspacePath, filePath, { signal }) : skipToken,
    enabled,
  });
}

export function useWorkspaceChanges(workspacePath: string | undefined, { enabled = true } = {}) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceChanges(workspacePath),
    queryFn: workspacePath ? ({ signal }) => web.workspaceChanges(workspacePath, { signal }) : skipToken,
    enabled,
  });
}

export function useWorkspacePatches(
  workspacePath: string | undefined,
  scope: WorkspaceChangesScope,
  { enabled = true } = {},
) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspacePatches(workspacePath, scope),
    queryFn: workspacePath ? ({ signal }) => web.workspacePatches(workspacePath, scope, { signal }) : skipToken,
    enabled,
  });
}
