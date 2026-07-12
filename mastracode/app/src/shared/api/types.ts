/**
 * Wire contracts shared by the MastraCode app and its HTTP hosts.
 *
 * The platform-neutral package owns these shapes. Web and desktop servers
 * import them when assembling responses, preventing either renderer from
 * depending on a server implementation package.
 */

export interface ProviderInfo {
  provider: string;
  envVar?: string;
  displayName?: string;
  oauthSupported?: boolean;
  source: 'oauth' | 'stored' | 'env' | 'none';
}

export interface CustomProviderInfo {
  id: string;
  name: string;
  url: string;
  hasApiKey: boolean;
  models: string[];
}

export interface ModelPackInfo {
  id: string;
  name: string;
  description: string;
  models: {
    build: string;
    plan: string;
    fast: string;
  };
  custom: boolean;
  active: boolean;
}

export interface OMConfigInfo {
  observerModelId: string;
  reflectorModelId: string;
  observationThreshold: number;
  reflectionThreshold: number;
  observeAttachments: 'auto' | boolean;
}

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface DirectoryListing {
  root: string;
  path: string;
  parent: string | null;
  entries: DirectoryEntry[];
}

// ── GET response envelopes ─────────────────────────────────────────────────

export interface ProvidersResponse {
  credentialManagementEnabled: boolean;
  providers: ProviderInfo[];
}

export interface CustomProvidersResponse {
  providers: CustomProviderInfo[];
}

export interface ModelPacksResponse {
  packs: ModelPackInfo[];
  activePackId: string | null;
}

export interface OMResponse {
  config: OMConfigInfo;
}

// ── Mutation request bodies ────────────────────────────────────────────────

export interface SaveProviderKeyBody {
  key: string;
  envVar?: string;
}

export interface StartProviderOAuthResponse {
  ok: true;
  loginId: string;
  authUrl: string;
  completionMode: 'browser-callback' | 'manual-code';
  expiresInMs: number;
  instructions?: string;
}

export interface CompleteProviderOAuthBody {
  loginId: string;
  code: string;
}

export interface SaveCustomProviderBody {
  name: string;
  url: string;
  apiKey?: string;
  models: string[];
  /** When editing, the id of the provider being replaced. */
  previousId?: string;
}

export interface SaveModelPackBody {
  name: string;
  models: { build: string; plan: string; fast: string };
}

export interface ActivateModelPackBody {
  resourceId: string;
}

export interface UpdateOMModelBody {
  resourceId: string;
  modelId: string;
}

export interface UpdateOMThresholdsBody {
  resourceId: string;
  observationThreshold?: number;
  reflectionThreshold?: number;
}

export interface UpdateOMObserveAttachmentsBody {
  resourceId: string;
  value: 'auto' | boolean;
}

// ── Mutation response envelopes ────────────────────────────────────────────

export interface OkResponse {
  ok: true;
}

export interface SaveProviderKeyResponse {
  ok: true;
  provider?: ProviderInfo;
}

export interface CompleteProviderOAuthResponse {
  ok: true;
  provider?: ProviderInfo;
}

export interface ActivateModelPackResponse {
  ok: true;
  activePackId: string;
}

export interface UpdateOMResponse {
  ok: true;
  config: OMConfigInfo;
}
