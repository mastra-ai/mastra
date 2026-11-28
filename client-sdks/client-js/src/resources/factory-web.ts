import type {
  ArtifactListing,
  ModelCatalogEntry,
  ProviderInfo,
  DirectoryListing,
  LiveSessionResponse,
  MastraGatewayCredits,
  ModelPackSet,
  ModelSelectionRequest,
  OAuthPollResponse,
  OAuthStartResponse,
  PersonalModelDefaultsResponse,
  ProvidersResponse,
  SaveProviderKeyResponse,
  SessionModelCatalog,
  SessionModelResponse,
  SessionModelTarget,
  SettingsModelCatalog,
  TranscribeResponse,
  VoiceSettingsResponse,
  WorkspaceChangePatches,
  WorkspaceChanges,
  WorkspaceChangesScope,
  WorkspaceFile,
  WorkspaceFileIndex,
  WorkspaceRenderedListing,
  WorkspaceTreeListing,
} from '@internal/factory-contract';
import type { ClientOptions } from '../types';

import { BaseResource } from './base';
import { toFactoryRequestError } from './factory';

export type {
  ArtifactListing,
  ModelCatalogEntry,
  ModelPackSet,
  ModelSelectionRequest,
  ProviderInfo,
  DirectoryListing,
  LiveSessionResponse,
  MastraGatewayCredits,
  OAuthPollResponse,
  OAuthStartResponse,
  PersonalModelDefaultsResponse,
  ProvidersResponse,
  SaveProviderKeyResponse,
  SessionModelCatalog,
  SessionModelResponse,
  SessionModelTarget,
  SettingsModelCatalog,
  TranscribeResponse,
  VoiceSettingsResponse,
  WorkspaceChangePatches,
  WorkspaceChanges,
  WorkspaceChangesScope,
  WorkspaceFile,
  WorkspaceFileIndex,
  WorkspaceRenderedListing,
  WorkspaceTreeListing,
};

export interface FactoryWebOptions {
  /** Where the host serves Factory's config, voice and workspace routes. Defaults to Factory's own `/web`. */
  webBasePath?: string;
}

export type CredentialWriteScope = 'user' | 'org';

/** Settings catalogs read a scope or a Factory project; a session catalog reads the session. */
export type ModelCatalogTarget = { scope: CredentialWriteScope } | { factoryProjectId: string } | Record<string, never>;

interface Read {
  signal?: AbortSignal;
}

const provider = (id: string) => `/config/providers/${encodeURIComponent(id)}`;
const scoped = (scope: CredentialWriteScope | undefined) => (scope ? `?scope=${scope}` : '');
const forFactory = (factoryProjectId: string | undefined) =>
  factoryProjectId ? `?factoryId=${encodeURIComponent(factoryProjectId)}` : '';

/**
 * The routes a Factory session reads outside Factory's own `/web/factory` prefix: model config, provider
 * credentials, voice and the session workspace. Every host serves them under its own `webBasePath`.
 */
export class FactoryWeb extends BaseResource {
  constructor(options: ClientOptions, { webBasePath = '/web' }: FactoryWebOptions = {}) {
    // React Query owns retries; one attempt per call keeps failures visible to it.
    super({ ...options, apiPrefix: webBasePath, retries: options.retries ?? 0 });
  }

  public override async request<T>(...args: Parameters<BaseResource['request']>): Promise<T> {
    try {
      return await super.request<T>(...args);
    } catch (error) {
      throw toFactoryRequestError(error);
    }
  }

  // Model config

  defaultModel({ signal }: Read = {}) {
    return this.request<PersonalModelDefaultsResponse>('/config/default-model', { signal });
  }

  setDefaultModel(modelId: string) {
    return this.request<{ ok: true; modelId: string }>('/config/default-model', { method: 'PUT', body: { modelId } });
  }

  setModelPacks(set: ModelPackSet) {
    return this.request<PersonalModelDefaultsResponse>('/config/model-packs', { method: 'PUT', body: set });
  }

  models(target: ModelCatalogTarget = {}, { signal }: Read = {}) {
    const query =
      'scope' in target
        ? `?scope=${target.scope}`
        : 'factoryProjectId' in target
          ? forFactory(target.factoryProjectId)
          : '';
    return this.request<SettingsModelCatalog>(`/config/models${query}`, { signal });
  }

  sessionModels(target: SessionModelTarget, { signal }: Read = {}) {
    const query = new URLSearchParams({
      sessionId: target.sessionId,
      resourceId: target.resourceId,
      threadId: target.threadId,
    });
    return this.request<SessionModelCatalog>(`/config/models?${query}`, { signal });
  }

  setSessionModel(target: SessionModelTarget, selection: ModelSelectionRequest) {
    return this.request<SessionModelResponse>('/config/session-model', {
      method: 'PUT',
      body: { ...target, selection },
    });
  }

  // Provider credentials

  providers({ signal }: Read = {}) {
    return this.request<ProvidersResponse>('/config/providers', { signal });
  }

  saveProviderKey(id: string, body: { key: string; envVar?: string; scope?: CredentialWriteScope }) {
    return this.request<SaveProviderKeyResponse>(`${provider(id)}/key`, { method: 'PUT', body });
  }

  removeProviderKey(id: string, scope?: CredentialWriteScope) {
    return this.request<SaveProviderKeyResponse>(`${provider(id)}/key${scoped(scope)}`, { method: 'DELETE' });
  }

  connectProvider(id: string, scope?: CredentialWriteScope) {
    return this.request<SaveProviderKeyResponse>(`${provider(id)}/connect`, { method: 'POST', body: { scope } });
  }

  providerCredits(id: string, { signal }: Read = {}) {
    return this.request<MastraGatewayCredits>(`${provider(id)}/credits`, { signal });
  }

  startProviderOAuth(id: string, body: { mode?: string; scope?: CredentialWriteScope } = {}) {
    return this.request<OAuthStartResponse>(`${provider(id)}/oauth/start`, { method: 'POST', body });
  }

  completeProviderOAuth(id: string, body: { sessionId: string; code: string }) {
    return this.request<{ status: 'complete' }>(`${provider(id)}/oauth/complete`, { method: 'POST', body });
  }

  pollProviderOAuth(id: string, sessionId: string) {
    return this.request<OAuthPollResponse>(`${provider(id)}/oauth/poll`, { method: 'POST', body: { sessionId } });
  }

  cancelProviderOAuth(id: string, sessionId: string) {
    return this.request<{ ok: true }>(`${provider(id)}/oauth/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  signOutProviderOAuth(id: string, scope?: CredentialWriteScope) {
    return this.request<{ ok: true }>(`${provider(id)}/oauth${scoped(scope)}`, { method: 'DELETE' });
  }

  // Voice

  voiceSettings(factoryProjectId: string, { signal }: Read = {}) {
    return this.request<VoiceSettingsResponse>(`/voice/settings${forFactory(factoryProjectId)}`, { signal });
  }

  setVoiceSettings(factoryProjectId: string, choice: { provider: string; model: string } | { provider: null }) {
    return this.request<VoiceSettingsResponse>('/voice/settings', {
      method: 'PUT',
      body: { factoryId: factoryProjectId, ...choice },
    });
  }

  transcribe(clip: Blob, factoryProjectId?: string) {
    return this.request<TranscribeResponse>(`/voice/transcribe${forFactory(factoryProjectId)}`, {
      method: 'POST',
      body: clip,
    });
  }

  liveVoiceSession(factoryProjectId?: string) {
    return this.request<LiveSessionResponse>(`/voice/live-session${forFactory(factoryProjectId)}`, {
      method: 'POST',
    });
  }

  // Workspace

  directory(path: string | undefined, { signal }: Read = {}) {
    return this.request<DirectoryListing>(path ? `/fs/list?${new URLSearchParams({ path })}` : '/fs/list', {
      signal,
    });
  }

  artifacts(path: string, { signal }: Read = {}) {
    return this.request<ArtifactListing>(`/artifacts/list?${new URLSearchParams({ path })}`, { signal });
  }

  workspaceRendered(workspacePath: string, root: string, { signal }: Read = {}) {
    return this.request<WorkspaceRenderedListing>(
      `/workspace/rendered/list?${new URLSearchParams({ workspacePath, root })}`,
      { signal },
    );
  }

  workspaceTree(workspacePath: string, path: string, { signal }: Read = {}) {
    return this.request<WorkspaceTreeListing>(`/workspace/tree?${new URLSearchParams({ workspacePath, path })}`, {
      signal,
    });
  }

  workspaceFiles(workspacePath: string, { signal }: Read = {}) {
    return this.request<WorkspaceFileIndex>(`/workspace/files?${new URLSearchParams({ workspacePath })}`, {
      signal,
    });
  }

  workspaceFile(workspacePath: string, path: string, { signal }: Read = {}) {
    return this.request<WorkspaceFile>(`/workspace/file?${new URLSearchParams({ workspacePath, path })}`, {
      signal,
    });
  }

  workspaceChanges(workspacePath: string, { signal }: Read = {}) {
    return this.request<WorkspaceChanges>(`/workspace/changes?${new URLSearchParams({ workspacePath })}`, {
      signal,
    });
  }

  workspacePatches(workspacePath: string, scope: WorkspaceChangesScope, { signal }: Read = {}) {
    return this.request<WorkspaceChangePatches>(
      `/workspace/changes/patches?${new URLSearchParams({ workspacePath, scope })}`,
      { signal },
    );
  }
}
