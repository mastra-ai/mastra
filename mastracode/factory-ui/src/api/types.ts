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
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import type { z } from 'zod';
import type { FACTORY_ROUTE_CONTRACTS } from '@mastra/factory/routes/contracts';

export type BoardCatalogResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.boardCatalog.responseSchema>;
export type InstalledBoardInfo = BoardCatalogResponse['boards'][number];
export type InstalledPhaseInfo = InstalledBoardInfo['phases'][number];
export type StoredBoardResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.boardGet.responseSchema>;
export type StoredBoardInfo = StoredBoardResponse['board'];
export type StoredPhaseInfo = StoredBoardInfo['phases'][number];
export type ReplaceBoardBody = z.input<typeof FACTORY_ROUTE_CONTRACTS.boardReplace.bodySchema>;
export type IntakeRouteListResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.intakeRouteList.responseSchema>;
export type IntakeRouteInfo = IntakeRouteListResponse['intakeRoutes'][number];
export type IntakeRouteInput = z.input<typeof FACTORY_ROUTE_CONTRACTS.intakeRouteCreate.bodySchema>;
export type IntakeRoutePatch = z.input<typeof FACTORY_ROUTE_CONTRACTS.intakeRouteUpdate.bodySchema>;
export type CreateBoardBody = z.input<typeof FACTORY_ROUTE_CONTRACTS.boardCreate.bodySchema>;
export type WorkItemStarters = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemStarters.responseSchema>;
export type WorkItemActivity = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemActivity.responseSchema>;
export type WorkItemListResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema>;
export type BoardPhasesResponse = z.infer<typeof FACTORY_ROUTE_CONTRACTS.boardPhases.responseSchema>;
export type WorkItemFilterOptions = z.infer<typeof FACTORY_ROUTE_CONTRACTS.workItemFilterOptions.responseSchema>;
type BoardPhasesQuery = z.output<typeof FACTORY_ROUTE_CONTRACTS.boardPhases.querySchema>;
export type BoardPhasesSort = BoardPhasesQuery['sort'];
/** The filters of a board view: each is sent once per picked value. */
export type BoardPhasesFilter = {
  [Field in keyof BoardPhasesQuery]-?: BoardPhasesQuery[Field] extends Set<string> ? Field : never;
}[keyof BoardPhasesQuery];

/** What the board read is asked: one view of a board, and how deep each of its phases is listed. */
export interface BoardPhasesRequest {
  board: string;
  sort: BoardPhasesSort;
  /** Empty searches nothing. */
  q: string;
  /** The picked values of each filter, sorted. A filter that picks nothing is left out. */
  filters: Partial<Record<BoardPhasesFilter, readonly string[]>>;
  /** How many cards a phase lists, for the phases listed deeper than the server's first page. */
  windows: Readonly<Record<string, number>>;
  /** A card to answer for apart from the listing: its body, and where each phase holding it places it. */
  item?: string;
}

import type {
  CustomProviderInfo,
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
  WorkspaceTreeEntry,
  WorkspaceTreeListing,
  WorkspaceRenderedEntry,
  WorkspaceRenderedListing,
  WorkspacePatchOmission,
};
export type { LiveSessionResponse, TranscribeResponse, VoiceSettingsResponse };

// ── GET response envelopes ─────────────────────────────────────────────────

export interface ProvidersResponse {
  providers: ProviderInfo[];
  /** Tenant mode: whether the caller may write org-wide keys. Absent locally. */
  orgKeyAdmin?: boolean;
}

export interface CustomProvidersResponse {
  providers: CustomProviderInfo[];
}

export interface DefaultModelResponse {
  modelId: string | null;
  thinkingLevel: ThinkingLevelSetting | null;
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
  /** Shipped with Factory, the app's `factory-skills/` folder, or `MastraFactory({ skills })`. Absent from older servers. */
  origin?: 'bundled' | 'folder' | 'code';
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

export interface SaveCustomProviderBody {
  name: string;
  url: string;
  apiKey?: string;
  models: string[];
  /** When editing, the id of the provider being replaced. */
  previousId?: string;
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

export interface UpdateOMResponse {
  ok: true;
  config: OMConfigInfo;
}

export type VoiceChoice = NonNullable<VoiceSettingsResponse['selected']>;
