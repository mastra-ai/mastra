export type {
  BoardCatalogResponse,
  InstalledBoardInfo,
  InstalledPhaseInfo,
  IntakeRouteInfo,
  IntakeRouteListResponse,
  ReplaceBoardBody,
  StoredBoardResponse,
} from '@internal/factory-contract';
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
import type { z } from 'zod';
import type { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';

import type { StoredBoardResponse } from '@internal/factory-contract';

export type { StoredBoardInfo, StoredPhaseInfo } from '@mastra/playground-ui/domains/factory';
export type IntakeOrderResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeOrderGet.responseSchema>;
export type IntakeNotRoutedResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeNotRoutedList.responseSchema>;
export type IntakeDecisionInfo = IntakeNotRoutedResponse['notRouted'][number];
export type IntakeRouteAgainResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeRouteAgain.responseSchema>;
export type IntakeSkippedResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeSkippedList.responseSchema>;
export type IntakeRouteInput = z.input<typeof FACTORY_ROUTE_CONTRACTS.intakeRouteCreate.bodySchema>;
export type IntakeRoutePatch = z.input<typeof FACTORY_ROUTE_CONTRACTS.intakeRouteUpdate.bodySchema>;
export type IntakeDryRunBody = z.input<typeof FACTORY_ROUTE_CONTRACTS.intakeDryRun.bodySchema>;
export type IntakeDryRunResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeDryRun.responseSchema>;
export type IntakeTestBody = z.input<typeof FACTORY_ROUTE_CONTRACTS.intakeTest.bodySchema>;
export type IntakeTestResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeTest.responseSchema>;
export type CreateBoardBody = z.input<typeof FACTORY_ROUTE_CONTRACTS.boardCreate.bodySchema>;
export type WorkItemStarters = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemStarters.responseSchema>;
export type WorkItemSessionRepository = z.infer<
  typeof FACTORY_ROUTE_CONTRACTS.workItemSessionRepository.responseSchema
>;
export type WorkItemActivity = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemActivity.responseSchema>;
export type WorkItemListResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema>;
export type BoardPhasesResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.boardPhases.responseSchema>;
export type WorkItemFilterOptions = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemFilterOptions.responseSchema>;
export type { BoardPhasesFilter, BoardPhasesRequest, BoardPhasesSort } from '@internal/factory-contract';

type SessionRowsQuery = z.output<typeof FACTORY_ROUTE_CONTRACTS.sessionRows.querySchema>;
export type SessionRowsResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.sessionRows.responseSchema>;
export type SessionRowWire = SessionRowsResponse['groups'][number]['rows'][number];
export type SessionActivity = z.infer<typeof FACTORY_ROUTE_CONTRACTS.sessionActivity.responseSchema>;

export interface SessionRowsRequest {
  sort: SessionRowsQuery['sort'];
  groupBy: SessionRowsQuery['groupBy'];
  owner: string;
  status?: SessionRowsQuery['status'];
  updated?: SessionRowsQuery['updated'];
  source?: SessionRowsQuery['source'];
  children: boolean;
  pin: readonly string[];
  open?: string;
  windows: Readonly<Record<string, number>>;
}

import type {
  CustomProviderCheckFailedResponse,
  CustomProviderCheckFailure,
  CustomProviderCheckResponse,
  CustomProviderHeaderInfo,
  CustomProviderInfo,
  CustomProviderModelsResult,
  CustomProviderModelTestResult,
  OMConfigInfo,
  ProviderInfo,
  ProviderOMDefaultsResponse,
} from '@mastra/factory/routes/config';
import type {
  ArtifactEntry,
  ArtifactListing,
  DirectoryEntry,
  DirectoryListing,
  WorkspaceChange,
  WorkspaceChangePatches,
  WorkspaceChanges,
  WorkspaceChangesRepository,
  WorkspaceChangesScope,
  WorkspaceChangeStatus,
  WorkspaceFile,
  WorkspaceFileIndex,
  WorkspaceTreeEntry,
  WorkspaceTreeListing,
  WorkspaceRenderedEntry,
  WorkspaceRenderedListing,
  WorkspacePatchOmission,
} from '@mastra/factory/routes/fs';
import type { MastraGatewayCredits } from '@mastra/factory/routes/mastra-gateway';
import type { LiveSessionResponse, TranscribeResponse, VoiceSettingsResponse } from '@mastra/factory/routes/voice';

export type { ProviderInfo, CustomProviderInfo, OMConfigInfo, ProviderOMDefaultsResponse, MastraGatewayCredits };
export type {
  OAuthPollResponse,
  OAuthStartResponse,
  ProvidersResponse,
  SaveProviderKeyResponse,
} from '@internal/factory-contract';
export type {
  CustomProviderCheckFailedResponse,
  CustomProviderCheckFailure,
  CustomProviderCheckResponse,
  CustomProviderHeaderInfo,
  CustomProviderModelsResult,
  CustomProviderModelTestResult,
};
export type {
  ArtifactEntry,
  ArtifactListing,
  DirectoryEntry,
  DirectoryListing,
  WorkspaceChange,
  WorkspaceChangePatches,
  WorkspaceChanges,
  WorkspaceChangesRepository,
  WorkspaceChangesScope,
  WorkspaceChangeStatus,
  WorkspaceFile,
  WorkspaceFileIndex,
  WorkspaceTreeEntry,
  WorkspaceTreeListing,
  WorkspaceRenderedEntry,
  WorkspaceRenderedListing,
  WorkspacePatchOmission,
};
export type { LiveSessionResponse, TranscribeResponse, VoiceSettingsResponse };

// ── GET response envelopes ─────────────────────────────────────────────────

export interface CustomProvidersResponse {
  providers: CustomProviderInfo[];
}

export interface OMResponse {
  config: OMConfigInfo;
}

/** A skill the Factory skill mount serves (`GET /web/factory/skills`). */
export interface FactorySkillInfo {
  name: string;
  description: string;
  /** SKILL.md body with the frontmatter removed. */
  content: string;
  /**
   * Shipped with Factory, the app's `factory-skills/` folder, `MastraFactory({ skills })`, or `project` for a skill
   * this Factory created. Absent from older servers.
   */
  origin?: 'bundled' | 'folder' | 'code' | 'project';
  /** True for a skill Factory ships, including when the app overrides it. Absent from older servers. */
  builtIn?: boolean;
  /** Set when the SKILL.md fails runtime parsing/validation; the agent will not be able to load the skill. */
  error?: string;
  /** Frontmatter fields besides name and description, kept when the skill is saved from the editor. */
  frontmatter?: Record<string, unknown>;
  /** Set when the project has an edited copy; description and content then come from the edit. */
  edited?: { updatedBy: string; updatedAt: string };
  /** True when the original SKILL.md changed since the project's edit was made. */
  originalChanged?: boolean;
  /** Set for a skill this Factory created (`origin: 'project'`): who saved it last, and when. */
  created?: { updatedBy: string; updatedAt: string };
}

export interface FactorySkillsResponse {
  skills: FactorySkillInfo[];
  /** Whether the caller may edit this project's skills. Present when the catalog is read for a project. */
  canEdit?: boolean;
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

/**
 * A custom header as a save or check request sends it. Without `value` the server keeps the saved value of
 * that name; an empty string is refused. Without `secret` a saved header keeps its flag and a new one is secret.
 */
export interface CustomProviderHeaderBody {
  name: string;
  value?: string;
  secret?: boolean;
}

/** The connection settings a save and a check both send. */
interface CustomProviderConnectionBody {
  url: string;
  apiKey?: string;
  authScheme?: CustomProviderInfo['authScheme'];
  /** The full list. Omitted on an edit keeps the saved list. */
  headers?: CustomProviderHeaderBody[];
}

export interface SaveCustomProviderBody extends CustomProviderConnectionBody {
  name: string;
  models: string[];
  /** When editing, the id of the provider being replaced. */
  previousId?: string;
  /** Where to save it: the caller's own providers (the default) or their organization's. */
  scope?: CustomProviderInfo['scope'];
  /** Run the connection test first and refuse to save when it fails (422 `custom_endpoint_check_failed`). */
  check?: boolean;
}

/**
 * `POST /web/config/custom-providers/check`. With `url` the draft is checked, reusing the saved secrets of
 * `previousId` on the same origin. With only `previousId` the saved row is checked as stored and its
 * `lastCheck` is recorded.
 */
export type CheckCustomProviderBody = {
  scope?: CustomProviderInfo['scope'];
  /** Also send the test message to this model. */
  model?: string;
} & ((CustomProviderConnectionBody & { previousId?: string }) | { previousId: string; url?: undefined });

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

export interface UpdateOMResponse {
  ok: true;
  config: OMConfigInfo;
}

export type VoiceChoice = NonNullable<VoiceSettingsResponse['selected']>;
