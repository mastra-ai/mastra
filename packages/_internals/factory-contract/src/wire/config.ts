import type { ModelReasoningOption } from '@mastra/core/llm';
import type { ThinkingLevelSetting } from '@mastra/core/llm/reasoning';
import type { ModelPackSet, ResolvedModelSelection } from '../model-packs.js';
import type {
  CredentialScope as StoredCredentialScope,
  LoginSessionKind,
  CustomProviderAuthScheme,
  CustomProviderLastCheck,
  CustomProviderCheckFailure,
  CustomProviderModelTestResult,
  CustomProviderModelsResult,
} from './config-leaves.js';

/**
 * Server-side configuration routes for the web app.
 *
 * The browser has no access to the credential store or the model catalog, so
 * the web settings panel asks the server — which owns both — to list providers
 * and manage API keys. This mirrors the TUI's `/api-keys` command, exposing the
 * same `AuthStorage`-backed key management over HTTP.
 *
 * Keys are never returned to the client; only their presence and source.
 */

/**
 * Where a provider's active credential comes from, as seen by the caller.
 * Local mode reports `oauth`/`stored` (server-global `auth.json`); tenant mode
 * reports the scoped variants (`oauth-user`/`stored-user`/`stored-org`).
 * `deployment` (tenant mode) marks a provider the operator opted in to run on
 * the server process's own credentials (e.g. Amazon Bedrock's AWS chain).
 */
export type ProviderCredentialSource =
  | 'deployment'
  | 'oauth'
  | 'stored'
  | 'env'
  | 'none'
  | 'oauth-user'
  | 'oauth-org'
  | 'stored-user'
  | 'stored-org';

/** A model provider with the current source of its credentials. */
export interface ProviderInfo {
  provider: string;
  /** Env var the provider's key is read from, if any. */
  envVar?: string;
  /** Where the active credential comes from. */
  source: ProviderCredentialSource;
  /**
   * Tenant mode: whether an org-wide API key exists for this provider, even
   * when the caller's personal credential shadows it. Lets the UI tell
   * "shared with the org" apart from "only works for me".
   */
  orgKey?: boolean;
  /**
   * Tenant mode: the caller's personal credential for this provider, if any.
   * Reported independently of `source` so the UI can manage each scope even
   * when one shadows the other.
   */
  userCredential?: 'oauth' | 'api_key';
  /** Tenant mode: the caller's personal sign-in could not be renewed and must be redone. */
  userCredentialExpired?: true;
  /** Tenant mode: the shared org credential for this provider, if any. */
  orgCredential?: 'oauth' | 'api_key';
  /** Tenant mode: the shared org sign-in could not be renewed and must be redone. */
  orgCredentialExpired?: true;
  /** Web OAuth sign-in capability, when the provider supports it. */
  oauth?: { supported: true; modes: LoginSessionKind[] };
  /** The provider is a stored custom OpenAI-compatible endpoint. */
  custom?: true;
  /** Tenant mode: Factory can mint this provider's key with the caller's Mastra account (the Mastra Gateway). */
  connectWithMastraAccount?: true;
  /**
   * Tenant mode: the server has its own key for this provider (the Mastra Gateway), which serves
   * any scope that has no stored credential. Reported apart from `source`, which names only the
   * credential that wins for the caller.
   */
  serverKey?: true;
}

/** A saved custom header as the client sees it. */
export interface CustomProviderHeaderInfo {
  name: string;
  secret: boolean;
  /** Present only for headers that are not secret. */
  value?: string;
}

/** A user-defined OpenAI-compatible provider, with key presence (never the key). */
export interface CustomProviderInfo {
  id: string;
  name: string;
  url: string;
  hasApiKey: boolean;
  authScheme: CustomProviderAuthScheme;
  headers: CustomProviderHeaderInfo[];
  models: string[];
  /** Saved for the caller (`user`) or for their organization (`org`), like a provider key. */
  scope: StoredCredentialScope;
  /** Why this server refuses to call the endpoint. Its models are not offered until the URL is fixed. */
  urlProblem?: string;
  /**
   * The last connection test, cleared when the URL, key, auth scheme or headers
   * change. It records the connection test only, never a test message.
   */
  lastCheck?: CustomProviderLastCheck;
}

/** The response of `POST /web/config/custom-providers/check`. A failing check is data here, not an HTTP error. */
export interface CustomProviderCheckResponse {
  ok: true;
  check: { models: CustomProviderModelsResult; reply?: CustomProviderModelTestResult };
  /** Present when a saved row was checked and its `lastCheck` was recorded. */
  provider?: CustomProviderInfo;
}

/** The 422 body of a save with `check: true` whose connection test failed. Nothing is written. */
export interface CustomProviderCheckFailedResponse {
  error: 'custom_endpoint_check_failed';
  message: string;
  failure: CustomProviderCheckFailure;
}

export type ModelCredentialHolder = 'personal' | 'organization' | 'deployment';

/** A model the caller can pick or switch to. */
export interface ModelCatalogEntry {
  id: string;
  provider: string;
  modelName: string;
  releaseDate?: string;
  hasApiKey: true;
  reasoningOptions?: ModelReasoningOption[];
  credentialLabel?: string;
  credentialHolder?: ModelCredentialHolder;
}

// Mirrors the TUI `/om` command. Settings are persisted per organization and
// user in the Factory app database, then loaded into request context for each
// invocation without copying them into mutable session state.

export interface OMRoleConfigInfo {
  model: 'auto' | string;
  effectiveModelId: string;
  effectiveModelSource: 'explicit' | 'live-session' | 'configured-default';
  providerStatus: 'available' | 'unavailable';
}

/** Persisted intent plus the concrete models the current Factory configuration resolves. */
export interface OMConfigInfo {
  observer: OMRoleConfigInfo;
  reflector: OMRoleConfigInfo;
  /** @deprecated Use `observer.effectiveModelId`. */
  observerModelId: string;
  /** @deprecated Use `reflector.effectiveModelId`. */
  reflectorModelId: string;
  observationThreshold: number;
  reflectionThreshold: number;
  observeAttachments: 'auto' | boolean;
}

export interface ProviderOMDefaultsResponse {
  ok: true;
  config: OMConfigInfo;
}

export interface PersonalModelDefaultsResponse extends ModelPackSet {
  modelId: string | null;
  thinkingLevel: ThinkingLevelSetting | null;
}

export interface SessionModelPackSelection extends ModelPackSet {
  modelSelection: ResolvedModelSelection;
}

export interface SessionModelPolicy extends SessionModelPackSelection {
  modelScope: 'factory' | 'user';
  defaultModelId: string | null;
  personalThinkingLevel: ThinkingLevelSetting | null;
  models: ModelCatalogEntry[];
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  /** Tenant mode: whether the caller may write org-wide keys. Absent locally. */
  orgKeyAdmin?: boolean;
}

export interface SaveProviderKeyResponse {
  ok: true;
  provider?: ProviderInfo;
}

export interface OAuthStartResponse {
  sessionId: string;
  kind: 'paste-code' | 'device-code';
  url: string;
  userCode?: string;
  instructions: string;
  expiresAt: number;
  nextPollMs?: number;
}

export type OAuthPollResponse =
  | { status: 'pending'; nextPollMs: number }
  | { status: 'complete' }
  | { status: 'failed'; error: string };

/** `GET /web/config/models` for a scope or Factory project. */
export interface SettingsModelCatalog {
  models: ModelCatalogEntry[];
  /** null when no key in this scope can run the built-in start model */
  fallbackModelId?: string | null;
}

/** `GET /web/config/models` for a running session: its models plus the session's model policy. */
export interface SessionModelCatalog extends Partial<Omit<SessionModelPolicy, 'models'>> {
  models: ModelCatalogEntry[];
}

export interface SessionModelTarget {
  resourceId: string;
  threadId: string;
  sessionId: string;
}

export interface SessionModelResponse {
  modelSelection: ResolvedModelSelection;
}
