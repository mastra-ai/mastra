/**
 * Wire contracts for the web/RN settings API surface.
 *
 * These are RE-EXPORTED from the server route modules so there is a single
 * source of truth: the request/response shapes here are exactly what the Hono
 * routes produce. Re-exporting (rather than re-declaring) means a contract
 * change on the server is a typecheck failure here and in every consumer.
 *
 * `import type` keeps this module type-only — no server runtime code is pulled
 * into the shared/platform-agnostic bundle.
 */
import type {
  CustomProviderInfo,
  ModelPackInfo,
  OMConfigInfo,
  ProviderInfo,
  ProviderOMDefaultsResponse,
} from '@mastra/factory/routes/config';
import type {
  ArtifactEntry,
  ArtifactListing,
  DirectoryEntry,
  DirectoryListing,
  WorkspaceFile,
  WorkspaceRenderedEntry,
  WorkspaceRenderedListing,
} from '@mastra/factory/routes/fs';

export type { ProviderInfo, CustomProviderInfo, ModelPackInfo, OMConfigInfo, ProviderOMDefaultsResponse };
export type {
  ArtifactEntry,
  ArtifactListing,
  DirectoryEntry,
  DirectoryListing,
  WorkspaceFile,
  WorkspaceRenderedEntry,
  WorkspaceRenderedListing,
};

// ── GET response envelopes ─────────────────────────────────────────────────

export interface ProvidersResponse {
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
  scope?: 'user' | 'org';
}

export interface OAuthStartBody {
  mode?: string;
}

export interface OAuthCompleteBody {
  sessionId: string;
  code: string;
}

export interface OAuthSessionBody {
  sessionId: string;
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

export interface ActivateModelPackResponse {
  ok: true;
  activePackId: string;
}

export interface UpdateOMResponse {
  ok: true;
  config: OMConfigInfo;
}
