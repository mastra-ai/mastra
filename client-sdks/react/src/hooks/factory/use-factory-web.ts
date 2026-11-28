import type {
  DirectoryListing,
  FactoryWeb,
  MastraGatewayCredits,
  PersonalModelDefaultsResponse,
  WorkspaceFileIndex,
  ModelCatalogEntry,
  ModelPackSet,
  ModelSelectionRequest,
  ProviderInfo,
  ProvidersResponse,
  SessionModelCatalog,
  SessionModelTarget,
  SettingsModelCatalog,
  VoiceSettingsResponse,
  WorkspaceChangePatches,
  WorkspaceChanges,
  WorkspaceChangesScope,
  WorkspaceFile,
} from '@mastra/client-js';
import type { QueryClient, UseQueryOptions } from '@tanstack/react-query';
import { queryOptions, skipToken, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { useFactoryWeb } from './context';
import { factoryWebKeys } from './web-keys';
import type { AvailableModelsFilter } from './web-keys';

/**
 * A credential change (key saved/removed, OAuth completed, signed out) alters which models are
 * runnable, so the model catalog and voice settings refetch along with the provider list.
 */
function invalidateCredentialDependentQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: factoryWebKeys.providers() }),
    queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() }),
    queryClient.invalidateQueries({ queryKey: factoryWebKeys.voiceSettingsAll() }),
  ]);
}

// Model config

export function defaultModelQueryOptions(
  web: FactoryWeb,
): UseQueryOptions<
  PersonalModelDefaultsResponse,
  Error,
  PersonalModelDefaultsResponse,
  ReturnType<typeof factoryWebKeys.defaultModel>
> {
  return queryOptions({
    queryKey: factoryWebKeys.defaultModel(),
    queryFn: ({ signal }) => web.defaultModel({ signal }),
  });
}

export function useDefaultModelQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ ...defaultModelQueryOptions(useFactoryWeb()), enabled });
}

export function useSetDefaultModel() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (modelId: string) => web.setDefaultModel(modelId),
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

export type AvailableModelOption = ModelCatalogEntry;

export interface AvailableModelsTarget extends AvailableModelsFilter {
  enabled?: boolean;
}

export interface SessionModelCatalogTarget
  extends Omit<AvailableModelsFilter, keyof SessionModelTarget>, SessionModelTarget {
  enabled?: boolean;
}

function settingsModels(web: FactoryWeb, target: AvailableModelsTarget | undefined, signal: AbortSignal) {
  if (target?.scope) return web.models({ scope: target.scope }, { signal });
  if (target?.factoryProjectId) return web.models({ factoryProjectId: target.factoryProjectId }, { signal });
  return web.models({}, { signal });
}

function sessionModels(web: FactoryWeb, target: SessionModelCatalogTarget, signal: AbortSignal) {
  return web.sessionModels(
    { sessionId: target.sessionId, resourceId: target.resourceId, threadId: target.threadId },
    { signal },
  );
}

/** Settings catalogs use the Factory's scope or the caller's own personal credentials. */
export function availableModelsQueryOptions(
  web: FactoryWeb,
  target?: AvailableModelsTarget,
): UseQueryOptions<
  SettingsModelCatalog,
  Error,
  SettingsModelCatalog,
  ReturnType<typeof factoryWebKeys.availableModels>
> {
  return queryOptions({
    queryKey: factoryWebKeys.availableModels(
      target && { factoryProjectId: target.factoryProjectId, scope: target.scope },
    ),
    queryFn: ({ signal }) => settingsModels(web, target, signal),
  });
}

export function sessionModelCatalogQueryOptions(
  web: FactoryWeb,
  target?: SessionModelCatalogTarget,
): UseQueryOptions<SessionModelCatalog, Error, SessionModelCatalog, ReturnType<typeof factoryWebKeys.availableModels>> {
  return queryOptions({
    queryKey: factoryWebKeys.availableModels({
      factoryProjectId: target?.factoryProjectId,
      sessionId: target?.sessionId,
      resourceId: target?.resourceId,
      threadId: target?.threadId,
    }),
    queryFn: target ? ({ signal }) => sessionModels(web, target, signal) : skipToken,
    enabled: target !== undefined && target.enabled !== false,
  });
}

export function useSessionModelCatalogQuery(target?: SessionModelCatalogTarget) {
  return useQuery(sessionModelCatalogQueryOptions(useFactoryWeb(), target));
}

/** A target naming a session reads that session's catalog; otherwise the settings catalog. */
export function useAvailableModelsQuery(target?: AvailableModelsTarget) {
  const web = useFactoryWeb();
  const session: SessionModelCatalogTarget | undefined =
    target?.sessionId && target.resourceId && target.threadId
      ? { ...target, sessionId: target.sessionId, resourceId: target.resourceId, threadId: target.threadId }
      : undefined;
  const queryKey = session
    ? sessionModelCatalogQueryOptions(web, session).queryKey
    : availableModelsQueryOptions(web, target).queryKey;
  return useQuery<SettingsModelCatalog | SessionModelCatalog, Error, AvailableModelOption[]>({
    queryKey,
    queryFn: ({ signal }) => (session ? sessionModels(web, session, signal) : settingsModels(web, target, signal)),
    enabled: target?.enabled !== false,
    select: catalog => catalog.models,
  });
}

export function useScopeModelCatalogQuery(scope: 'org' | 'user') {
  return useQuery(availableModelsQueryOptions(useFactoryWeb(), { scope }));
}

export function useFallbackModelQuery(target: AvailableModelsTarget) {
  return useQuery({
    ...availableModelsQueryOptions(useFactoryWeb(), target),
    enabled: target.enabled !== false,
    select: catalog => catalog.fallbackModelId ?? undefined,
  });
}

export function useModelReasoningOptions(modelId: string | undefined, target?: AvailableModelsTarget) {
  const { data: models } = useAvailableModelsQuery(target);
  return models?.find(model => model.id === modelId)?.reasoningOptions;
}

/**
 * Switches a session's model. `onSettled` lets the host refresh the runtime state it keeps for
 * the session (Factory's agent settings) once the switch lands or fails.
 */
export function useSetSessionModelMutation(
  target: SessionModelTarget,
  { onSaved }: { onSaved?: () => Promise<unknown> } = {},
) {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: factoryWebKeys.sessionModel(target.sessionId),
    mutationFn: (selection: ModelSelectionRequest) => web.setSessionModel(target, selection),
    onSuccess: () =>
      Promise.all([onSaved?.(), queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() })]),
    onError: () => queryClient.invalidateQueries({ queryKey: factoryWebKeys.availableModels() }),
  });
}

// Provider credentials

const MASTRA_GATEWAY_CATALOG_PROVIDER = 'mastra';

export function providersQueryOptions(
  web: FactoryWeb,
): UseQueryOptions<ProvidersResponse, Error, ProvidersResponse, ReturnType<typeof factoryWebKeys.providers>> {
  return queryOptions({
    queryKey: factoryWebKeys.providers(),
    queryFn: ({ signal }) => web.providers({ signal }),
  });
}

export function useProvidersQuery() {
  return useQuery({
    ...providersQueryOptions(useFactoryWeb()),
    select: (body: ProvidersResponse): ProviderInfo[] => body.providers,
  });
}

/**
 * Whether the caller may write org-wide keys. Shares the providers cache entry. Fails open when
 * the server doesn't report it: the write route is the authority and rejects non-admin writes.
 */
export function useOrgKeyAdminQuery() {
  return useQuery({
    ...providersQueryOptions(useFactoryWeb()),
    select: (body: ProvidersResponse): boolean => body.orgKeyAdmin ?? true,
  });
}

export interface SaveProviderKeyArgs {
  provider: string;
  key: string;
  envVar?: string;
  scope?: 'user' | 'org';
}

export function useSaveProviderKey() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, key, envVar, scope }: SaveProviderKeyArgs) =>
      web.saveProviderKey(provider, {
        key,
        ...(envVar !== undefined ? { envVar } : {}),
        ...(scope !== undefined ? { scope } : {}),
      }),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

export function useConnectMastraGateway() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scope }: { scope?: 'user' | 'org' }) => web.connectProvider(MASTRA_GATEWAY_CATALOG_PROVIDER, scope),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

/** A payment finished in another tab lands in the balance when the user comes back. */
export function useMastraGatewayCreditsQuery() {
  const web = useFactoryWeb();
  return useQuery<MastraGatewayCredits>({
    queryKey: factoryWebKeys.mastraGatewayCredits(),
    queryFn: ({ signal }) => web.providerCredits(MASTRA_GATEWAY_CATALOG_PROVIDER, { signal }),
    refetchOnWindowFocus: 'always',
  });
}

export interface RemoveProviderKeyArgs {
  provider: string;
  scope?: 'user' | 'org';
}

export function useRemoveProviderKey() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, scope }: RemoveProviderKeyArgs) => web.removeProviderKey(provider, scope),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

export interface ProviderOAuthArgs {
  provider: string;
}

export interface StartProviderOAuthArgs extends ProviderOAuthArgs {
  mode?: string;
  /** `'org'` shares the completed sign-in with the whole org (admin-only). */
  scope?: 'user' | 'org';
}

export function useStartProviderOAuth() {
  const web = useFactoryWeb();
  return useMutation({
    mutationFn: ({ provider, mode, scope }: StartProviderOAuthArgs) =>
      web.startProviderOAuth(provider, {
        ...(mode !== undefined ? { mode } : {}),
        ...(scope !== undefined ? { scope } : {}),
      }),
  });
}

export interface CompleteProviderOAuthArgs extends ProviderOAuthArgs {
  sessionId: string;
  code: string;
}

export function useCompleteProviderOAuth() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, sessionId, code }: CompleteProviderOAuthArgs) =>
      web.completeProviderOAuth(provider, { sessionId, code }),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

export interface PollProviderOAuthArgs extends ProviderOAuthArgs {
  sessionId: string;
}

export function usePollProviderOAuth() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, sessionId }: PollProviderOAuthArgs) => web.pollProviderOAuth(provider, sessionId),
    onSuccess: response => {
      if (response.status === 'complete') return invalidateCredentialDependentQueries(queryClient);
    },
  });
}

export interface CancelProviderOAuthArgs extends ProviderOAuthArgs {
  sessionId: string;
}

export function useCancelProviderOAuth() {
  const web = useFactoryWeb();
  return useMutation({
    mutationFn: ({ provider, sessionId }: CancelProviderOAuthArgs) => web.cancelProviderOAuth(provider, sessionId),
  });
}

export interface SignOutProviderOAuthArgs extends ProviderOAuthArgs {
  /** `'org'` removes the shared org sign-in (admin-only). */
  scope?: 'user' | 'org';
}

export function useSignOutProviderOAuth() {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, scope }: SignOutProviderOAuthArgs) => web.signOutProviderOAuth(provider, scope),
    onSuccess: () => invalidateCredentialDependentQueries(queryClient),
  });
}

// Voice

export type VoiceModel = VoiceSettingsResponse['models'][number];
export type VoiceKeyStatus = VoiceSettingsResponse['keys'][number];
export type VoiceChoice = { provider: string; model: string };

export function useVoiceSettings(factoryProjectId: string) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.voiceSettings(factoryProjectId),
    queryFn: ({ signal }) => web.voiceSettings(factoryProjectId, { signal }),
  });
}

/**
 * Saves the model voice input uses; `null` goes back to auto. The response refreshes this
 * Factory's cache; other Factories refetch because a personal choice is shared across them.
 */
export function useUpdateVoiceSettings(factoryProjectId: string) {
  const web = useFactoryWeb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: VoiceChoice | null) => web.setVoiceSettings(factoryProjectId, choice ?? { provider: null }),
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

export function isPlanReadablePath(path: string | undefined): path is string {
  return Boolean(
    path &&
    /^(?:[^/.][^/]*\/)?\.artifacts\/.+/.test(path) &&
    !path.includes('..') &&
    !path.includes('\\') &&
    !path.includes('\0'),
  );
}

/**
 * Resolve submitted plan paths beneath the workspace or a repository checkout's `.artifacts`
 * root. Relative paths pass through; absolute paths are normalized only against an authoritative
 * `rootPath` from the rendered listing. Traversal, wrong-root, backslash, and NUL inputs are
 * rejected; the backend still enforces its own path and symlink guards.
 */
export function normalizePlanPath(
  path: string | undefined,
  rootPath: string | undefined,
  root = '.artifacts',
): string | undefined {
  if (!path) return undefined;
  if (path.includes('\\') || path.includes('\0')) return undefined;
  if (path.split('/').includes('..')) return undefined;
  if (!path.startsWith('/')) return isPlanReadablePath(path) ? path : undefined;
  if (!rootPath) return undefined;
  const base = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;
  // Sandbox file tools resolve absolute paths against the workspace root, so agents may submit
  // `/mastra/.artifacts/...` for `/workspace/mastra/.artifacts/...`.
  const workspaceBase = `/${root}`;
  const matchedBase = [base, workspaceBase].find(candidate => path === candidate || path.startsWith(`${candidate}/`));
  if (!matchedBase) return undefined;
  const remainder = path.slice(matchedBase.length).replace(/^\/+/, '');
  const relative = remainder ? `${root}/${remainder}` : root;
  return isPlanReadablePath(relative) ? relative : undefined;
}

/** The server lists directories confined to its configured root; an absent `path` lists the root. */
export function useDirectoryListing(path: string | undefined) {
  const web = useFactoryWeb();
  return useQuery<DirectoryListing>({
    queryKey: factoryWebKeys.fsList(path),
    placeholderData: previousData => previousData,
    queryFn: ({ signal }) => web.directory(path, { signal }),
  });
}

export function useArtifactListing(path: string | undefined) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.artifactsList(path),
    queryFn: path ? ({ signal }) => web.artifacts(path, { signal }) : skipToken,
  });
}

export function useWorkspaceRenderedListing(
  workspacePath: string | undefined,
  renderedRoot: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceRenderedList(workspacePath, renderedRoot),
    enabled,
    queryFn:
      workspacePath && renderedRoot
        ? ({ signal }) => web.workspaceRendered(workspacePath, renderedRoot, { signal })
        : skipToken,
  });
}

/**
 * One directory of a session's checkouts, read live from its sandbox (`''` is the top level).
 * Each open folder is its own query, so a refresh only refetches what is on screen.
 */
export function useWorkspaceTree(
  workspacePath: string | undefined,
  path: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const web = useFactoryWeb();
  return useQuery({
    queryKey: factoryWebKeys.workspaceTree(workspacePath, path),
    enabled,
    queryFn: workspacePath ? ({ signal }) => web.workspaceTree(workspacePath, path, { signal }) : skipToken,
  });
}

export function useWorkspaceTrees(workspacePath: string, paths: readonly string[]) {
  const web = useFactoryWeb();
  return useQueries({
    queries: paths.map(path => ({
      queryKey: factoryWebKeys.workspaceTree(workspacePath, path),
      queryFn: ({ signal }: { signal: AbortSignal }) => web.workspaceTree(workspacePath, path, { signal }),
    })),
  });
}

export function workspaceFileIndexQueryOptions(
  web: FactoryWeb,
  workspacePath: string | undefined,
): UseQueryOptions<
  WorkspaceFileIndex,
  Error,
  WorkspaceFileIndex,
  ReturnType<typeof factoryWebKeys.workspaceFileIndex>
> {
  return queryOptions({
    queryKey: factoryWebKeys.workspaceFileIndex(workspacePath),
    queryFn: workspacePath ? ({ signal }) => web.workspaceFiles(workspacePath, { signal }) : skipToken,
  });
}

export function useWorkspaceFileIndex(
  workspacePath: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({ ...workspaceFileIndexQueryOptions(useFactoryWeb(), workspacePath), enabled });
}

export function useWorkspaceFile<TData = WorkspaceFile>(
  workspacePath: string | undefined,
  filePath: string | undefined,
  { enabled = true, select }: { enabled?: boolean; select?: (file: WorkspaceFile) => TData } = {},
) {
  const web = useFactoryWeb();
  return useQuery<WorkspaceFile, Error, TData>({
    queryKey: factoryWebKeys.workspaceFile(workspacePath, filePath),
    enabled,
    queryFn:
      workspacePath && filePath ? ({ signal }) => web.workspaceFile(workspacePath, filePath, { signal }) : skipToken,
    select,
  });
}

/**
 * A submitted plan's markdown. Keyed by `toolCallId` so a resubmission (same path, new tool call)
 * fetches the revised file instead of replaying the previous one from cache.
 */
export function usePlanFile(
  workspacePath: string | undefined,
  path: string | undefined,
  toolCallId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const web = useFactoryWeb();
  return useQuery<WorkspaceFile>({
    queryKey: factoryWebKeys.planFile(workspacePath, path, toolCallId),
    enabled,
    queryFn:
      workspacePath && isPlanReadablePath(path)
        ? ({ signal }) => web.workspaceFile(workspacePath, path, { signal })
        : skipToken,
  });
}

export function useWorkspaceChanges<TData = WorkspaceChanges>(
  workspacePath: string | undefined,
  { enabled = true, select }: { enabled?: boolean; select?: (changes: WorkspaceChanges) => TData } = {},
) {
  const web = useFactoryWeb();
  return useQuery<WorkspaceChanges, Error, TData>({
    queryKey: factoryWebKeys.workspaceChanges(workspacePath),
    enabled,
    select,
    queryFn: workspacePath ? ({ signal }) => web.workspaceChanges(workspacePath, { signal }) : skipToken,
  });
}

export function useWorkspacePatches(
  workspacePath: string | undefined,
  scope: WorkspaceChangesScope,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const web = useFactoryWeb();
  return useQuery<WorkspaceChangePatches>({
    queryKey: factoryWebKeys.workspacePatches(workspacePath, scope),
    enabled,
    queryFn: workspacePath ? ({ signal }) => web.workspacePatches(workspacePath, scope, { signal }) : skipToken,
  });
}
