/**
 * Harness v1 — shared types.
 *
 * One file for now. Split when it grows past readability or when a section
 * becomes a class with real methods (e.g. Session).
 *
 * See HARNESS_V1_SPEC.md.
 */

import type { z } from 'zod';

import type { Agent } from '../../agent';
import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { AgentSignalAttributes, CreatedAgentSignal } from '../../agent/signals';
import type { ToolsInput } from '../../agent/types';
import type { ChannelProvider } from '../../channels';
import type { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import type { MastraCompositeStore } from '../../storage/base';
import type {
  AttachmentObjectPointer,
  AttachmentRendererDescriptor,
  AttachmentSource,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelDeliverySemantics,
  ChannelInboxItem,
  ChannelOutboxEnqueueOptions,
  ChannelOutboxItem,
  ChannelOutboxOperationKind,
  ChannelProviderDeliveryReceipt,
  HarnessAttachmentKind,
  HarnessPrimitiveType,
  PersistedRequestContextInput,
  HarnessRowErrorCode,
  HarnessStorage,
  JsonValue,
  SessionRecord as StoredSessionRecord,
} from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';
import type { Workspace } from '../../workspace';
import type { ProcessHandle } from '../../workspace/sandbox/process-manager';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

// ---------------------------------------------------------------------------
// HarnessMode (§4.2).
//
// Modes are policy overlays on a backing Agent: they pin which agent runs,
// can override or extend its tool surface, and can layer extra instructions
// for the duration of the mode. `transitionsTo` lets `submit_plan` flip
// mode atomically with approval.
// ---------------------------------------------------------------------------

export interface HarnessMode {
  /** Unique within `HarnessConfig.modes`. Validated at construction. */
  id: string;

  /**
   * Backing agent. Must reference a key in `HarnessConfig.agents`.
   * Validated at construction — unknown id throws `HarnessConfigError`.
   */
  agentId: string;

  /** Surfaced in mode pickers / Studio UI. Free text. */
  description?: string;

  /**
   * Layered above the backing agent's own instructions for the duration
   * of this mode. Plain text by design — modes carve operating profile,
   * not full system-message overrides.
   */
  instructions?: string;

  /**
   * The tool set this mode runs with. **Replaces** the backing agent's
   * tools — the agent's own tools are hidden for the duration of the
   * mode. Mutually exclusive with `additionalTools` (validated at
   * construction).
   */
  tools?: ToolsInput;

  /**
   * Tools layered on top of the backing agent's tools. The agent's tools
   * stay; these are added. Mutually exclusive with `tools`.
   */
  additionalTools?: ToolsInput;

  /**
   * Optional plan→build target. When `submit_plan` runs in this mode, the
   * registered `PendingResume` freezes this value as `transitionModeId`.
   * On approval, the session flips to this mode
   * idempotently (§5.1, §5.7). If unset, plan approval resumes with no
   * mode change. Must reference another mode's `id`.
   */
  transitionsTo?: string;

  /**
   * Arbitrary user-defined metadata. Pass-through only — the harness
   * never reads or validates it. Use for UI affordances like display
   * color, icon, display name overrides, or any per-mode configuration
   * that isn't part of the harness's own contract.
   *
   * Surfaced verbatim on `getCurrentMode()` and `listModes()`.
   */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Permissions (§4.2e).
//
// The permission gate combines tool identity (name + category), session
// policy (rules + grants), harness defaults, and tool-owned approval flags
// to decide allow / ask / deny for each tool invocation. These types are
// the public surface; the gate evaluation lives next to the tool dispatch
// path.
// ---------------------------------------------------------------------------

/**
 * Coarse-grained classification used to write rules without enumerating
 * every tool. Resolved per-call via `HarnessConfig.toolCategoryResolver`.
 *
 * The `'mcp'` category covers tools provided by MCP servers; `'other'` is
 * the bucket for anything an integration intentionally leaves
 * unclassified.
 */
export type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp' | 'other';

/**
 * Outcome of a permission rule (§4.2e). Per-tool rules win over category
 * rules; explicit `'deny'` is terminal. Session-scoped grants can suppress
 * an `'ask'` reason but never override `'deny'`.
 */
export type PermissionPolicy = 'allow' | 'ask' | 'deny';

/**
 * Catalog entry exposed through `harness.models.*` (§9). Purely a UX
 * surface — the harness does not interpret these fields, it only stores
 * and returns them. The catalog is intended for model pickers, auth-
 * status pills, and capability hints in UIs.
 */
export interface ModelInfo {
  /**
   * Stable id used by every `harness.models.*` accessor and by all other
   * `modelId` fields in the harness (mode `agentId`'s resolved model,
   * per-turn `HarnessOverrides.model`, etc). Must be unique within the
   * catalog.
   */
  id: string;
  /** Provider id (e.g. `'anthropic'`, `'openai'`, `'bedrock'`). */
  providerId: string;
  /** Human-readable label for UIs. Defaults to `id` when absent. */
  displayName?: string;
  /** Max context window in tokens, when known. */
  contextWindow?: number;
  /** Free-form capability hints. Harness does not interpret these. */
  capabilities?: readonly string[];
  /** Provider-specific extras passed through to UIs verbatim. */
  metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Auth state for a catalog model entry. `'authenticated'` means a
 * usable credential is on hand; `'needs_auth'` means the UI should
 * prompt the user to sign in; `'unknown'` means the resolver could not
 * decide (and is also the default when no
 * {@link HarnessConfigCommon.modelAuthStatusResolver} is configured).
 */
export type ModelAuthStatus = 'authenticated' | 'needs_auth' | 'unknown';

// ---------------------------------------------------------------------------
// Harness channel registry (§9.3 / §14.1).
//
// PF-369 wires static provider/binding registration and validation only.
// Ingress/action/outbox workers consume these descriptors in later slices.
// ---------------------------------------------------------------------------

export type ChannelConversationKind = 'dm' | 'group-dm' | 'channel' | 'thread';
export type ChannelIngressTrigger = 'message' | 'mention' | 'subscribed-message' | 'command';
export type ChannelIngressDelivery = 'message' | 'queue';
export type ChannelBindingMode = 'per-user-resource' | 'shared-resource' | 'thread-resource' | 'custom';

export interface HarnessChannelTransportRequest {
  method: string;
  path: string;
  url?: string;
  headers: Record<string, string | string[]>;
  query?: Record<string, string | string[]>;
  rawBody?: Uint8Array | string;
  body?: unknown;
  receivedAt?: number;
}

export interface ChannelActorContext {
  platformUserId: string;
  displayName?: string;
  metadata?: Record<string, JsonValue>;
}

export interface ChannelIngressEnvelope {
  platform: string;
  conversationKind: ChannelConversationKind;
  trigger: ChannelIngressTrigger;
  externalTenantId?: string;
  externalChannelId?: string;
  externalThreadId: string;
  externalMessageId: string;
  content: string;
  actor?: ChannelActorContext;
  files?: AttachmentRef[];
  receivedAt: number;
  raw?: unknown;
}

export interface ChannelActionEnvelope {
  actionId: string;
  token: string;
  response: unknown;
  actor?: ChannelActorContext;
  raw?: unknown;
}

export interface HarnessChannelRouteContext {
  harnessName: string;
  channelId: string;
  providerId: string;
  platform: string;
  provider: ChannelProvider;
  route: 'inbound' | 'action';
}

export interface ChannelIngressContext extends ChannelIngressEnvelope {
  harnessName: string;
  channelId: string;
  providerId: string;
}

export interface HarnessChannelDeliveryContext extends Omit<HarnessChannelRouteContext, 'route'> {
  binding: HarnessChannelBinding;
}

export interface ChannelOutboxDeliveryPlan {
  operationKind: ChannelOutboxOperationKind;
  operationName?: string;
  deliverySemantics: ChannelDeliverySemantics;
}

export interface ChannelOutboxDispatchOptions {
  channelId?: string;
  limit?: number;
  claimId?: string;
  now?: number;
  claimTtlMs?: number;
}

export interface ChannelOutboxDispatchResult {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  items: Array<{
    outboxItemId: string;
    status: Extract<ChannelOutboxItem['status'], 'sent' | 'failed' | 'dead'>;
    providerMessageId?: string;
    error?: { code: string; message: string };
  }>;
}

export interface HarnessChannelAdapter {
  verifyInbound?(
    request: HarnessChannelTransportRequest,
    ctx: HarnessChannelRouteContext,
  ): Promise<ChannelIngressEnvelope>;
  verifyAction?(
    request: HarnessChannelTransportRequest,
    ctx: HarnessChannelRouteContext,
  ): Promise<ChannelActionEnvelope>;
  deliverySemantics?: ChannelDeliverySemantics;
  deliverySemanticsByOperation?: Partial<Record<ChannelOutboxOperationKind, ChannelDeliverySemantics>>;
  resolveDeliveryPlan?(
    item: ChannelOutboxEnqueueOptions,
    ctx: HarnessChannelDeliveryContext,
  ): Promise<ChannelOutboxDeliveryPlan> | ChannelOutboxDeliveryPlan;
  reconcileDelivery?(
    item: ChannelOutboxItem,
    ctx: HarnessChannelDeliveryContext,
  ): Promise<{
    delivered: boolean;
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }>;
  deliver(
    item: ChannelOutboxItem,
    ctx: HarnessChannelDeliveryContext,
  ): Promise<{
    providerMessageId?: string;
    providerReceipt?: ChannelProviderDeliveryReceipt;
  }>;
}

export interface ChannelIngressPolicy {
  defaultDelivery?: ChannelIngressDelivery;
  dms?: 'per-user-resource' | 'shared-resource' | 'reject';
  mentions?: 'thread-resource' | 'shared-resource' | 'reject';
  sharedThreads?: 'shared-resource' | 'reject';
  resolveResource(ctx: ChannelIngressContext): Promise<{
    resourceId: string;
    threadId?: string;
    sessionId?: string;
    mode: ChannelBindingMode;
    admission?: {
      delivery?: ChannelIngressDelivery;
      mode?: string;
      model?: string;
    };
  }>;
}

export interface HarnessChannelWorkerConfig {
  maxAttempts?: number;
  claimTtlMs?: number;
  claimRenewMs?: number;
  maxClockSkewMs?: number;
  batchSize?: number;
  pollIntervalMs?: number;
  retryBackoffMs?: (attempt: number) => number;
}

export interface HarnessChannelConfig {
  providerId?: string;
  platform?: string;
  adapter: HarnessChannelAdapter;
  ingress: ChannelIngressPolicy;
  bindingId?: string;
  callbackTarget?: string;
  inbox?: HarnessChannelWorkerConfig;
  actions?: HarnessChannelWorkerConfig;
  outbox?: HarnessChannelWorkerConfig;
}

export interface HarnessChannelBinding {
  harnessName: string;
  channelId: string;
  bindingId: string;
  providerId: string;
  platform: string;
  callbackTarget: string;
  durableId: string;
}

export interface HarnessChannelDiagnosticsOptions {
  sessionId: string;
  resourceId: string;
  /**
   * Maximum rows returned per diagnostic ledger.
   */
  limit?: number;
}

export interface HarnessChannelDiagnosticError {
  code: HarnessRowErrorCode;
  retryable?: boolean;
}

export interface HarnessChannelDiagnosticLease {
  attempts: number;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
}

export interface HarnessChannelInboxDiagnostic {
  id: string;
  status: ChannelInboxItem['status'];
  channelId: string;
  providerId: string;
  bindingId?: string;
  admissionId: string;
  resourceId?: string;
  threadId?: string;
  sessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
  externalMessageId: string;
  delivery?: ChannelInboxItem['delivery'];
  mode?: string;
  model?: string;
  receivedAt: number;
  admittedAt?: number;
  acceptedAt?: number;
  queuedAt?: number;
  failedAt?: number;
  deadAt?: number;
  updatedAt: number;
  lease: HarnessChannelDiagnosticLease;
  lastError?: HarnessChannelDiagnosticError;
}

export interface HarnessChannelActionTokenDiagnostic {
  actionTokenId: string;
  status: 'active' | 'expired' | 'revoked';
  channelId: string;
  providerId: string;
  bindingId: string;
  bindingGeneration: number;
  resourceId: string;
  owningSessionId: string;
  itemId: string;
  kind: ChannelActionToken['kind'];
  runId: string;
  pendingRequestedAt: number;
  expiresAt?: number;
  revokedAt?: number;
  revokedReason?: ChannelActionToken['revokedReason'];
  createdAt: number;
  updatedAt: number;
}

export interface HarnessChannelActionReceiptDiagnostic {
  id: string;
  status: ChannelActionReceipt['status'];
  channelId: string;
  providerId: string;
  actionTokenId: string;
  actionId: string;
  bindingId: string;
  bindingGeneration: number;
  resourceId: string;
  owningSessionId: string;
  itemId: string;
  kind: ChannelActionReceipt['kind'];
  runId: string;
  pendingRequestedAt: number;
  conflictReason?: ChannelActionReceipt['conflictReason'];
  acceptedAt?: number;
  appliedAt?: number;
  failedAt?: number;
  deadAt?: number;
  createdAt: number;
  updatedAt: number;
  lease: HarnessChannelDiagnosticLease;
  lastError?: HarnessChannelDiagnosticError;
}

export interface HarnessChannelOutboxDiagnostic {
  id: string;
  status: ChannelOutboxItem['status'];
  channelId: string;
  providerId: string;
  bindingId: string;
  bindingGeneration: number;
  resourceId: string;
  threadId: string;
  sessionId?: string;
  owningSessionId?: string;
  source?: Pick<NonNullable<ChannelOutboxItem['source']>, 'kind' | 'id'>;
  kind: ChannelOutboxItem['kind'];
  operationKind: ChannelOutboxItem['operationKind'];
  operationName?: string;
  deliverySemantics: ChannelOutboxItem['deliverySemantics'];
  sentAt?: number;
  failedAt?: number;
  deadAt?: number;
  createdAt: number;
  updatedAt: number;
  lease: HarnessChannelDiagnosticLease;
  lastError?: HarnessChannelDiagnosticError;
}

export interface HarnessChannelDiagnostics {
  harnessName: string;
  resourceId: string;
  sessionId: string;
  visibleSessionIds: string[];
  bindings: HarnessChannelBinding[];
  inbox: HarnessChannelInboxDiagnostic[];
  actionTokens: HarnessChannelActionTokenDiagnostic[];
  actionReceipts: HarnessChannelActionReceiptDiagnostic[];
  outbox: HarnessChannelOutboxDiagnostic[];
  limit: number;
  truncated: boolean;
  redacted: true;
}

export interface HarnessFileConfig {
  maxInlineBytes?: number;
  maxUrlBytes?: number;
  urlFetchTimeoutMs?: number;
  maxUrlRedirects?: number;
  stagedAttachmentRetentionMs?: number;
  allowPrivateNetworkUrls?: boolean;
  allowedUrlMimeTypes?: readonly string[];
}

// ---------------------------------------------------------------------------
// HarnessSkill (§4.6).
//
// A skill is a named, parameterised prompt invoked via
// `session.skills.use(ref, opts)`. Skills are sourced from the static
// HarnessConfig registry and the session's configured `WorkspaceSkills`.
// Static skills resolve by name; workspace skills resolve by name or path.
// Static skills win on name conflicts so deployment-owned prompts can
// intentionally override workspace-discovered prompts. Explicit workspace
// path refs remain available for callers that need to invoke a shadowed
// workspace skill intentionally.
// ---------------------------------------------------------------------------

/**
 * Public skill descriptor. See §4.6.
 *
 * Code-registered directly through {@link HarnessConfigCommon.skills} or
 * projected from the workspace `WorkspaceSkills` source into this shape.
 * Workspace-internal fields (references, scripts, assets, license,
 * compatibility) remain owned by `WorkspaceSkills` and are not surfaced here.
 */
export interface HarnessSkill {
  /** Lookup key for code skills and the primary `session.skills.use(name, ...)` path. */
  name: string;

  /** Shown in tool catalogues / UIs. */
  description: string;

  /**
   * Prompt body. When invoked with `args`, the harness appends a JSON code
   * block carrying the validated arguments to this body before delegating to
   * the agent — skill authors reference the args naturally in Markdown.
   */
  instructions: string;

  /** Optional category tag (mirrors workspace skill metadata when present). */
  category?: string;

  /**
   * Optional desktop action-catalog metadata for UIs that expose skills as
   * user-invoked actions. Harness does not execute or enforce these hints;
   * permission gates still run at tool execution time.
   */
  action?: HarnessSkillActionMetadata;

  /**
   * Optional path-like locator (e.g. `skills/my-skill/SKILL.md`). Present when
   * the workspace skill source exposes one; otherwise omitted.
   */
  filePath?: string;

  /**
   * Pass-through skill metadata (e.g. `goal: true` for skills that should
   * appear under `/goal/<name>`). `session.skills.use()` validates the
   * optional `args` schema before dispatch; other fields remain caller-owned.
   * Code-registered skills accept only primitives, arrays, and plain objects
   * here so returned descriptors cannot share mutable class instances with
   * the original config.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Desktop action-catalog metadata attached to a Harness skill.
 *
 * These fields are intentionally descriptive. They let desktop hosts render
 * forms, shortcut palettes, permission summaries, and expected artifact
 * outputs without loading every skill body into model context.
 */
export interface HarnessSkillActionMetadata {
  /** Optional user-facing label when different from the skill name. */
  displayName?: string;
  /** Optional icon token owned by the host UI. */
  icon?: string;
  /** Keyboard or command palette shortcuts that invoke this skill. */
  shortcuts?: readonly HarnessSkillActionShortcut[];
  /** JSON-schema-like input descriptor for action forms. */
  inputSchema?: Readonly<Record<string, unknown>>;
  /** JSON-schema-like output descriptor for result previews. */
  outputSchema?: Readonly<Record<string, unknown>>;
  /** Artifact MIME types or host-owned artifact ids this action may produce. */
  artifactTypes?: readonly string[];
  /** Permission hints for preflight UI. Enforcement remains separate. */
  permissions?: HarnessSkillActionPermissionHints;
}

export interface HarnessSkillActionShortcut {
  /** Stable shortcut id within the skill descriptor. */
  id: string;
  /** User-facing shortcut label. Defaults to `id` when absent. */
  label?: string;
  /** Command palette aliases or key chords such as `mod+k`. */
  keys?: readonly string[];
}

export interface HarnessSkillActionPermissionHints {
  /** Tool ids/names likely needed by this action. */
  tools?: readonly string[];
  /** File scope labels or root ids likely needed by this action. */
  fileScopes?: readonly string[];
  /** Network hosts, protocols, or policy labels likely needed by this action. */
  networkScopes?: readonly string[];
  /** MCP server or scope labels likely needed by this action. */
  mcpScopes?: readonly string[];
}

/**
 * Read-only MCP server descriptor for Harness desktop catalogs.
 *
 * The catalog is an inventory snapshot of servers registered on the Harness
 * Mastra instance. It does not imply execution permission; tool execution and
 * auth filtering remain owned by the MCP server/tool runtime.
 */
export interface HarnessMcpServerDescriptor {
  /** Mastra registration key used for `session.mcp.getServer(key)`. */
  key: string;
  /** Logical MCP server id, which may be shared by versioned registrations. */
  id: string;
  /** Display name from the registered MCP server. */
  name: string;
  /** Server version. */
  version: string;
  /** Optional human-readable description. */
  description?: string;
  /** Optional usage instructions from the server. */
  instructions?: string;
  /** Release date as exposed by the server. */
  releaseDate: string;
  /** Whether this registration represents the server's latest version. */
  isLatest: boolean;
  /** Optional repository metadata. */
  repository?: Record<string, unknown>;
  /** Optional canonical package ecosystem label. */
  packageCanonical?: string;
  /** Optional installable package descriptors. */
  packages?: readonly Record<string, unknown>[];
  /** Optional remote endpoint descriptors. */
  remotes?: readonly Record<string, unknown>[];
}

/**
 * Read-only MCP tool descriptor for Harness desktop catalogs.
 */
export interface HarnessMcpToolDescriptor {
  /** Registered MCP server key that owns this tool. */
  serverKey: string;
  /** Tool id/name within the server. */
  name: string;
  /** Optional human-readable tool description. */
  description?: string;
  /** JSON-schema-like input descriptor when safely cloneable. */
  inputSchema?: unknown;
  /** JSON-schema-like output descriptor when safely cloneable. */
  outputSchema?: unknown;
  /** MCP tool type when the server exposes one. */
  toolType?: string;
  /** MCP metadata when safely cloneable. */
  meta?: Record<string, unknown>;
  /** Whether the underlying Mastra tool is strict. */
  strict?: boolean;
}

/**
 * Source kinds exposed by the read-only desktop action catalog.
 */
export type HarnessActionCatalogSourceKind = 'skill' | 'mcp-tool';

export interface HarnessActionCatalogSkillSource {
  kind: 'skill';
  /** Skill name usable with `session.skills.use(name, ...)`. */
  skillName: string;
  /** Workspace path when the descriptor came from workspace discovery. */
  filePath?: string;
}

export interface HarnessActionCatalogMcpToolSource {
  kind: 'mcp-tool';
  /** Registered MCP server key. */
  serverKey: string;
  /** Tool id/name within the server. */
  toolName: string;
}

export type HarnessActionCatalogSource = HarnessActionCatalogSkillSource | HarnessActionCatalogMcpToolSource;

/**
 * Read-only action catalog entry for desktop hosts.
 *
 * Entries are inventory only. They carry enough metadata for palettes,
 * forms, shortcuts, and permission summaries, but do not expose execution or
 * lifecycle controls. Callers execute through the owning source surface
 * (`session.skills.use`, MCP tool runtime, or a future router).
 */
export interface HarnessActionCatalogEntry {
  /** Stable local catalog id, namespaced by source kind. */
  id: string;
  /** Source reference that can be used to locate the owning descriptor. */
  source: HarnessActionCatalogSource;
  /** Current availability hint for catalog UIs. */
  status: 'available';
  /** User-facing action label. */
  label: string;
  /** Optional human-readable description. */
  description?: string;
  /** Optional source category, currently skill-owned when present. */
  category?: string;
  /** Optional host-owned icon token. */
  icon?: string;
  /** Keyboard or command palette shortcuts. */
  shortcuts?: readonly HarnessSkillActionShortcut[];
  /** JSON-schema-like input descriptor for action forms. */
  inputSchema?: unknown;
  /** JSON-schema-like output descriptor for result previews. */
  outputSchema?: unknown;
  /** Artifact MIME types or host-owned artifact ids this action may produce. */
  artifactTypes?: readonly string[];
  /** Permission hints for preflight UI. Enforcement remains separate. */
  permissions?: HarnessSkillActionPermissionHints;
  /** MCP-specific display metadata when the source is an MCP tool. */
  mcp?: {
    serverName: string;
    serverVersion: string;
    toolType?: string;
    strict?: boolean;
    meta?: Record<string, unknown>;
  };
}

export interface HarnessActionCatalogListOptions {
  /** Case-insensitive substring search across labels, ids, descriptions, and source refs. */
  query?: string;
  /** Optional source-kind filter. */
  source?: HarnessActionCatalogSourceKind;
  /** Maximum entries to return. Defaults to 100; valid range is 0 through 500. */
  limit?: number;
  /** Number of filtered entries to skip before applying `limit`. */
  offset?: number;
}

/**
 * Options for {@link Session.skills.use}. See §4.6.
 */
export interface UseSkillOptions {
  /**
   * Arguments to inject into the skill prompt as a JSON code block. If the
   * resolved skill declares `metadata.args`, missing required keys,
   * unsupported schema shapes, and supported type/enum/property validation
   * failures throw {@link HarnessSkillArgsValidationError} before any turn
   * starts.
   */
  args?: Record<string, unknown>;

  /**
   * Optional per-call model override. Routed to the underlying signal dispatch
   * exactly as {@link Session.signal}'s `modelOverride`.
   */
  modelOverride?: string;
}

// ---------------------------------------------------------------------------
// Placeholders.
//
// These are intentionally empty/loose. Each gets filled in as we work
// through the corresponding section of the spec.
// ---------------------------------------------------------------------------

/**
 * Top-level Harness config (§9). Filled in field by field.
 *
 * Open-ended for now (`[key: string]: unknown`) so we can land fields one at
 * a time without forcing every consumer to update on each addition. Once all
 * fields land, the index signature comes off and this becomes a closed shape.
 */
/**
 * Top-level Harness config (§9).
 *
 * Two shapes are supported:
 *
 *   1. **Registered on a Mastra instance.** The Harness is created with no
 *      `mastra` / `agents` / `storage` of its own and is then registered as
 *      a child of a `Mastra` instance (`new Mastra({ harnesses: { default:
 *      harness } })` for a default harness, or another key for named
 *      harnesses).
 *      The parent calls `harness.__registerMastra(mastra, name)` and the
 *      harness reads agents and storage from there.
 *
 *   2. **Self-contained.** The Harness is constructed with `agents` (and
 *      optionally `storage`) and internally builds a private `Mastra`
 *      instance. This is the path scripts and tests take so the harness
 *      stays usable without setting up a full Mastra app.
 *
 * Either way, the runtime invariant after construction (and registration,
 * if applicable) is the same: `harness.mastra` is always a `Mastra`, and
 * agents / storage flow through it.
 *
 * `mastra`, `agents`, and `storage` are mutually exclusive at the top
 * level — passing both `mastra` and `agents`/`storage` throws
 * `HarnessConfigError` at construction.
 */
export type HarnessConfig = HarnessConfigCommon &
  (
    | {
        /**
         * Pre-built Mastra instance to drive this harness. Mutually
         * exclusive with top-level `agents` / `storage`.
         *
         * Prefer omitting this field when you want the parent `Mastra` to own
         * registration (`new Mastra({ harnesses })`).
         * A harness that is already bound to the same `Mastra` may still be
         * registered there under a configured harness name.
         */
        mastra: Mastra;
        agents?: never;
        storage?: never;
      }
    | {
        mastra?: never;
        /**
         * Agents addressable by id. `HarnessMode.agentId` references resolve
         * against the keys of this map. Validated at construction — an
         * unknown id in any mode throws `HarnessConfigError`. May be omitted
         * when the harness will be registered onto an existing Mastra.
         */
        agents?: Record<string, Agent>;

        /**
         * Storage backing the internal Mastra. Optional — the in-memory
         * default is fine for tests and short-lived scripts. Required for
         * any harness that survives process restart.
         */
        storage?: MastraCompositeStore;
      }
  );

export interface HarnessConfigCommon {
  /**
   * Operator-managed compatibility token for the configured runtime surface:
   * agents and prompts/tools, mode-to-agent bindings, model aliases, MCP
   * bindings, workspace provider wiring, and wrappers that affect run
   * semantics. Harness does not derive this value. Operators bump it when a
   * change is incompatible with non-terminal persisted work.
   *
   * When set, recoverable work snapshots the token and later fails closed with
   * `harness.runtime_dependency_drifted` if replay/resume observes a different
   * current token, including when a previously configured token is later unset.
   * Legacy rows without a snapshot continue ID-only validation.
   */
  runtimeCompatibilityGeneration?: string;

  /**
   * Operating modes. Each mode pins a backing agent and may override or
   * extend its tool surface and instructions. Mode ids must be unique;
   * each mode's `agentId` must reference an agent visible to the harness
   * (either through the parent Mastra or the inline `agents` map); each
   * mode's optional `transitionsTo` must reference another mode's `id`.
   * All validated at construction (or, for the registered-on-Mastra
   * shape, at registration time).
   *
   * May be empty (e.g. for harnesses that drive a single agent with no
   * mode policy). When empty, `defaultModeId` must also be omitted.
   *
   * See §9 and §4.2.
   */
  modes: HarnessMode[];

  /**
   * Default mode for fresh sessions when no `modeId` override is supplied
   * on `harness.session(...)`. Must reference a `modes[].id`. Required if
   * `modes` is non-empty; must be omitted otherwise.
   *
   * Explicit (rather than implicit `modes[0]`) so that reordering the
   * `modes` array can never silently change runtime behavior.
   */
  defaultModeId?: string;

  /**
   * Session-runtime config (§9 + §5). Currently only carries the storage
   * binding override; eviction, lease, and queue knobs land here as we
   * wire them up.
   */
  sessions?: {
    /**
     * Override for where SessionRecords, leases, and attachment metadata
     * are persisted. Defaults to the harness domain on the Mastra
     * instance's storage (`mastra.getStorage().stores.harness`). Pass
     * a custom adapter only if the harness needs to persist into a
     * different store than the rest of the Mastra app.
     *
     * Thread records and messages still live in the bound Mastra memory
     * store. If the session storage override is not the same object as the
     * bound Mastra storage's `stores.harness` domain, `threads.delete(...)`
     * fails closed before deleting session rows or global memory
     * thread/message rows for that harness. A separate session storage may only
     * attach to an existing memory thread; Harness writes a reserved internal
     * marker so later `threads.delete(...)` calls in other processes fail
     * closed instead of deleting global thread/message rows they cannot prove
     * are unowned.
     */
    storage?: HarnessStorage;

    /**
     * Maximum number of items allowed to wait in `pendingQueue` per session.
     * `session.queue(...)` rejects with `HarnessQueueFullError` when full.
     * Capacity check + durable append are atomic per session. Defaults to 100.
     */
    maxQueueDepth?: number;

    /**
     * Milliseconds allowed after the durable `closingAt` marker commits for
     * live sessions to drain admitted work before terminal `closedAt`. The
     * runtime persists `closeDeadlineAt = closingAt + closeTimeoutMs` and
     * reuses an existing deadline when repairing a partially completed close.
     * Must be a positive integer. Defaults to 30_000 ms (30s).
     */
    closeTimeoutMs?: number;
  };

  /**
   * Attachment ingress policy for inline, URL-ingested, and staged remote
   * attachments. Defaults are enforced by server/SDK consumers when a field is
   * omitted.
   */
  files?: HarnessFileConfig;

  /**
   * Subagent type registry (§9). When `types` is non-empty, the harness
   * registers a built-in `spawn_subagent` tool on every session. The tool's
   * `agentType` enum is drawn from the keys of this map.
   *
   * Validated at construction (or registration): each entry's `agentId`
   * must reference an agent visible to the harness, and each entry's
   * optional `modeId` must reference a mode in `modes`. Unknown ids throw
   * `HarnessConfigError`.
   *
   * `maxDepth` caps the subagent tree depth. A `spawn_subagent` call from
   * a session at depth equal to or greater than `maxDepth` returns a tool
   * error containing `HarnessSubagentDepthExceededError`. Default: `1`
   * (the top-level session can spawn one level of subagents).
   */
  subagents?: {
    maxDepth?: number;
    types: Record<string, SubagentDefinition>;
  };

  /**
   * Goal-loop defaults (§4.7). When a session calls `setGoal({ objective })`
   * without an explicit judge model or budget, these defaults are used.
   *
   * `defaultJudgeModel` falls back to the session's current model id when
   * unset. `defaultMaxTurns` defaults to 50.
   */
  goals?: {
    defaultJudgeModel?: string;
    defaultMaxTurns?: number;
  };

  /**
   * Default policy applied when a tool's resolved category has no rule and
   * no per-tool override (§4.2e). Set to `'allow'` to opt out of the gate
   * entirely; set to `'deny'` for a strict allow-list posture. Defaults to
   * `'ask'`.
   */
  defaultPermissionPolicy?: PermissionPolicy;

  /**
   * Resolves a tool name to its category for permission-gate evaluation
   * (§4.2e). Returning `null` leaves the tool uncategorised — only per-tool
   * rules apply, and `defaultPermissionPolicy` is the floor.
   *
   * Pure function — must not read from the harness or perform IO. Called
   * synchronously inside the gate.
   *
   * The function form is primary. {@link toolCategories} is accepted as
   * optional sugar and desugars to `(name) => toolCategories[name] ?? null`
   * at construction time. When both are provided the resolver wins.
   */
  toolCategoryResolver?: (toolName: string) => ToolCategory | null;

  /**
   * Optional sugar for {@link toolCategoryResolver} — a static
   * `toolName -> ToolCategory` map. Equivalent to passing a resolver of
   * `(name) => toolCategories[name] ?? null`. Ignored when
   * `toolCategoryResolver` is also set.
   */
  toolCategories?: Record<string, ToolCategory>;

  /**
   * Static catalog of model entries that the harness exposes through
   * `harness.models.*`. Lets UIs render a model picker and surface
   * per-model metadata (display name, context window, capability hints)
   * without going through provider plumbing.
   *
   * Each `id` must be unique within the catalog — duplicate ids throw
   * `HarnessConfigError` at construction. May be omitted entirely; in
   * that case `harness.models.list()` returns `[]` and
   * `harness.models.getAuthStatus()` throws
   * `HarnessModelNotFoundError` for every id.
   *
   * The catalog is not validated against {@link modes} — modes may
   * reference agents whose model is outside the catalog, and the catalog
   * may include models not currently bound to any mode. The catalog is
   * purely a UX surface.
   */
  models?: ModelInfo[];

  /**
   * Static, code-registered skills. These are merged ahead of the session's
   * workspace-discovered skills for `session.skills.list/get/use`.
   *
   * Each `name` must be unique within this array. When a workspace skill has
   * the same `name`, this code-registered descriptor wins.
   */
  skills?: HarnessSkill[];

  /**
   * Resolves a catalog model id to its current auth status. Called by
   * `harness.models.getAuthStatus(modelId)`. May return a `Promise`.
   *
   * The harness does not cache the resolver's result — every
   * `getAuthStatus()` call re-invokes it, since auth state changes
   * out-of-band (login/logout flows, expiring tokens). Implementations
   * should be cheap (read a credential file, check a cached provider
   * client, etc.) and never throw — surface unknowable cases as
   * `'unknown'`.
   *
   * If omitted, every authenticated lookup resolves to `'unknown'`.
   */
  modelAuthStatusResolver?: (modelId: string) => ModelAuthStatus | Promise<ModelAuthStatus>;

  /**
   * Harness channel bridge configuration (§9.3 / §14). Each record binds a
   * harness-local `channelId` to a registered Mastra `ChannelProvider`.
   * When set, construct with a parent `mastra` or register the harness through
   * `new Mastra({ channels, harnesses })` so provider bindings exist.
   *
   * PF-369 validates identity only. Later channel PRs consume these bindings
   * to mount ingress/action routes and durable inbox/outbox workers.
   */
  channels?: Record<string, HarnessChannelConfig>;

  /**
   * Workspace configuration (§2.7). Selects one of three ownership models —
   * `shared` (one workspace for the whole harness), `per-resource` (one per
   * `resourceId`, refcounted across that user's sessions), or `per-session`
   * (one per session, persisted in `SessionRecord.workspace`).
   *
   * `shared` accepts either a pre-built `Workspace` or a factory matching the
   * legacy harness signature `({ requestContext }) => Workspace`. `per-resource`
   * accepts the factory shorthand or a full `WorkspaceProvider`. `per-session`
   * requires the full `WorkspaceProvider` shape with `resumable: true` —
   * factory shorthands resolve to non-resumable providers and are rejected
   * at startup with `HarnessConfigError`.
   *
   * Provisioning is lazy by default; pass `eager: true` to provision on
   * `init()` / session create.
   */
  workspace?: HarnessWorkspaceConfig;

  // Remaining fields (files, intervals, observationalMemory) land here as we
  // wire them up.

  [key: string]: unknown;
}

/**
 * Discriminated union of workspace configurations (§2.7).
 *
 * - `shared`: one workspace for every session.
 * - `per-resource`: one workspace per resource, refcounted.
 * - `per-session`: one workspace per session, persisted across restarts.
 */
export type HarnessWorkspaceConfig =
  | {
      kind: 'shared';
      workspace: Workspace | ((ctx: { requestContext: RequestContext }) => Workspace | Promise<Workspace>);
      eager?: boolean;
    }
  | {
      kind: 'per-resource';
      provider: WorkspaceProvider | ((ctx: WorkspaceProviderContext) => Workspace | Promise<Workspace>);
      eager?: boolean;
    }
  | {
      kind: 'per-session';
      provider: WorkspaceProvider;
      eager?: boolean;
    };

/**
 * Subagent definition (§9). Declares one entry in
 * `HarnessConfig.subagents.types`. Each entry pins a backing agent and
 * optionally a mode + default model + tool surface override.
 *
 * The map key is the `agentType` referenced by `spawn_subagent` calls and
 * `subagent_*` events.
 */
export interface SubagentDefinition {
  /** Backing agent id. Must reference a key in `HarnessConfig.agents`. */
  agentId: string;

  /**
   * Mode the subagent's session runs in. Resolves in `HarnessConfig.modes`.
   * If unset, the subagent inherits the parent's mode.
   */
  modeId?: string;

  /**
   * Surfaced in the parent agent's `spawn_subagent` tool description so
   * the model can pick the right type.
   */
  description: string;

  /**
   * Default model id for this subagent type. Used when the spawn call does
   * not pass `modelOverride`. Falls back to the harness's resolved default
   * for the subagent's mode when unset.
   */
  defaultModelId?: string;

  /**
   * Default fork mode for this subagent type. Forked invocations clone the
   * parent thread and run on the parent's current mode/model so the subagent
   * can see the conversation context without writing into the active thread.
   * Per-call `spawn_subagent({ forked })` overrides this default.
   */
  forked?: boolean;

  /**
   * Tool surface override for this subagent type. When set, the subagent
   * runs with exactly these tools (replaces the backing agent's tools).
   * Mutually exclusive with the mode's own `tools` overlay — caller wins.
   */
  tools?: ToolsInput;

  /**
   * Workspace ownership model for the subagent session. `'inherit'` reuses
   * the parent's workspace; `'fresh'` provisions a new one. Default:
   * `'inherit'`. Workspace plumbing lands in a later slice — the field is
   * accepted now so configs don't need to change later.
   */
  workspace?: 'inherit' | 'fresh';

  /**
   * Workspace tool keys the subagent may see. When set, workspace tools not
   * in the list are hidden for the subagent turn while non-workspace tools
   * remain available.
   */
  allowedWorkspaceTools?: string[];

  /** Optional maximum number of steps for this subagent's execution loop. */
  maxSteps?: AgentExecutionOptionsBase<unknown>['maxSteps'];

  /** Optional stop condition for this subagent's execution loop. */
  stopWhen?: AgentExecutionOptionsBase<unknown>['stopWhen'];

  /**
   * Retention policy for the spawned subagent's session record. Default
   * `false` — the session is deleted from storage after `subagent_end`
   * fires, so heavy `spawn_subagent` workloads (parallel explore
   * subagents, large fan-out review/migration runs) do not accumulate
   * closed-but-undeleted rows.
   *
   * Set `true` for long-running specialized subagents that may be
   * re-attached after `subagent_end` — the row is preserved.
   *
   * Note: thread + message-row cleanup is NOT covered by this flag yet;
   * `deleteSession` does not cascade to thread rows. Operators that
   * need full thread/message cleanup should call
   * `harness.threads.delete(...)` themselves until the follow-up
   * commit lands cleanup wiring.
   */
  retain?: boolean;
}

/**
 * Persisted session shape (§5.1). The canonical definition lives in
 * `@mastra/core/storage/domains/harness/types` because adapters need it; the
 * harness layer re-exports it here so consumers can stay on a single import.
 */
export type SessionRecord = StoredSessionRecord;

/** Attachment handle returned by upload (§13.7). */
export interface AttachmentRef {
  attachmentId: string;
  resourceId: string;
  ownerSessionId?: string;
  bytes?: number;
  sha256?: string;
  source?: AttachmentSource;
  kind?: HarnessAttachmentKind;
  name?: string;
  mimeType?: string;
  primitiveType?: HarnessPrimitiveType;
  elementType?: string;
  renderer?: AttachmentRendererDescriptor;
  schemaId?: string;
  metadata?: Record<string, JsonValue>;
  object?: AttachmentObjectPointer;
}

// ---------------------------------------------------------------------------
// Session resolver options — discriminated union per §5.3.
// ---------------------------------------------------------------------------

interface SessionResolveCommon {
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  modelId?: string;
  /**
   * @internal — used when the caller has already created a thread outside
   * `session({ threadId: { fresh: true } })` but the new session should own
   * that thread for cascade cleanup. Currently used by forked subagents after
   * cloning the parent thread.
   */
  ownsThread?: boolean;
  /**
   * @internal — used by the built-in `spawn_subagent` tool to record the
   * child's depth in the subagent tree (parent + 1). Top-level callers
   * should leave this unset; it defaults to `0`.
   */
  subagentDepth?: number;
}

export interface SessionResolveByThread extends SessionResolveCommon {
  /**
   * Existing thread id, or `{ fresh: true }` to force a brand-new thread.
   * `{ fresh: true }` also flips `SessionRecord.ownsThread` to `true` so the
   * thread is deleted on cascade (§5.5).
   */
  threadId: string | { fresh: true };
  resourceId: string;
  sessionId?: string;
}

export interface SessionResolveById extends SessionResolveCommon {
  sessionId: string;
  threadId?: never;
  resourceId?: never;
}

export interface SessionResolveByIdScoped extends SessionResolveCommon {
  sessionId: string;
  resourceId: string;
  threadId?: never;
}

/**
 * Resource-only resolution: hydrate the most-recent active session for
 * `resourceId`, or create a fresh thread + session if none exists. Useful
 * for single-user CLIs that just want "give me a session for this user".
 */
export interface SessionResolveByResource extends SessionResolveCommon {
  resourceId: string;
  threadId?: never;
  sessionId?: never;
}

export type SessionResolveOptions =
  | SessionResolveByThread
  | SessionResolveById
  | SessionResolveByIdScoped
  | SessionResolveByResource;

// ---------------------------------------------------------------------------
// Sub-namespace option shapes for the Harness class.
// ---------------------------------------------------------------------------

/**
 * Public thread record returned by `harness.threads.*`. A thin façade over
 * the storage layer's `StorageThreadType` so the harness owns the shape its
 * callers see (and so we can swap the backing storage without breaking the
 * sidebar API).
 */
export interface ThreadRecord {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ThreadCreateOptions {
  resourceId: string;
  /** Optional explicit id. Useful for deterministic tests. Otherwise minted. */
  threadId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadListOptions {
  resourceId: string;
  /** Number of items per page, or `false` for no limit. Defaults to 100. */
  perPage?: number | false;
  /** Zero-indexed page. Defaults to 0. */
  page?: number;
  /** Sort order — `'createdAt' | 'updatedAt'` × `'ASC' | 'DESC'`. Adapter-defined default. */
  orderBy?: { column: 'createdAt' | 'updatedAt'; direction: 'ASC' | 'DESC' };
  /** AND-matched metadata filter. */
  metadata?: Record<string, unknown>;
}

export interface ThreadListResult {
  threads: ThreadRecord[];
  total: number;
  /** Echoes the requested page size; `false` indicates unbounded (no limit). */
  perPage: number | false;
  page: number;
  hasMore: boolean;
}

export interface ThreadGetOptions {
  resourceId: string;
  threadId: string;
}

export interface ThreadRenameOptions {
  resourceId: string;
  threadId: string;
  title: string;
  /** Optional metadata patch applied at the same time. Shallow-merged. */
  metadata?: Record<string, unknown>;
}

export interface ThreadCloneOptions {
  resourceId: string;
  /** Thread to copy from. Must belong to `resourceId`. */
  threadId: string;
  /** Optional explicit id for the new thread. */
  newThreadId?: string;
  /** Title for the new thread. Defaults to source title with a "(clone)" suffix. */
  title?: string;
  /** Metadata merged on top of `ThreadCloneMetadata` written by storage. */
  metadata?: Record<string, unknown>;
  /** Forwarded to the storage adapter for message-copy filtering. */
  messageLimit?: number;
}

export interface ThreadSelectOrCreateOptions {
  resourceId: string;
  /** If supplied and owned by `resourceId`, returned as-is. Otherwise create. */
  threadId?: string;
  /** Used only when creating. */
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadDeleteOptions {
  resourceId: string;
  threadId: string;
}

/**
 * Shallow-merge patch applied to thread metadata via
 * `harness.threads.setSettings()`. Keys with `value: undefined` are removed;
 * all other keys overwrite existing values. Patch semantics mirror
 * `Session.setState()` so callers don't have to learn two write models.
 */
export interface ThreadSetSettingsOptions {
  resourceId: string;
  threadId: string;
  /** Shallow-merge patch. Keys set to `undefined` are deleted. */
  patch: Record<string, unknown>;
}

export interface ThreadGetSettingsOptions {
  resourceId: string;
  threadId: string;
}

export interface ThreadGetSettingOptions {
  resourceId: string;
  threadId: string;
  key: string;
}

export interface SessionListOptions {
  resourceId: string;
  includeClosed?: boolean;
}

export interface SessionLoadByIdOptions {
  sessionId: string;
  includeClosed?: boolean;
}

export interface SessionDeleteOptions {
  sessionId: string;
  resourceId: string;
  force?: boolean;
}

export interface FileAttachmentUploadOptions {
  sessionId: string;
  resourceId?: string;
  kind?: 'file';
  data: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  filename: string;
  contentType: string;
  metadata?: Record<string, JsonValue>;
}

export interface PrimitiveAttachmentUploadOptions {
  sessionId: string;
  resourceId?: string;
  kind: 'primitive';
  name: string;
  primitiveType: HarnessPrimitiveType;
  value: JsonValue;
  mimeType?: string;
  metadata?: Record<string, JsonValue>;
}

export interface ElementAttachmentUploadOptions {
  sessionId: string;
  resourceId?: string;
  kind: 'element';
  name: string;
  elementType: string;
  payload: JsonValue;
  renderer?: AttachmentRendererDescriptor;
  schemaId?: string;
  mimeType?: string;
  metadata?: Record<string, JsonValue>;
}

export type AttachmentUploadOptions =
  | FileAttachmentUploadOptions
  | PrimitiveAttachmentUploadOptions
  | ElementAttachmentUploadOptions;

export interface AttachmentDeleteOptions {
  attachmentId: string;
  sessionId: string;
  resourceId?: string;
}

export interface ShutdownOptions {
  drainTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Session.message() — §4.2.
//
// `message()` is the always-accept signal-driven entry point. The shape of
// the call decides what comes back:
//
//   * default                          → AgentResult bundle (await everything)
//   * { stream: true }                 → live MastraModelOutput
//   * { output: schema, sync: true }   → fail-fast structured object
//
// `stream: true` and `output` are mutually exclusive. `sync: true` is only
// valid alongside `output` (it's the fail-fast typed path; spec §4.2).
// Per-turn overrides (model, mode, additionalTools) are intentionally a
// narrow subset of `HarnessOverrides`; richer override surfaces land with
// `queue()` and goal loops.
// ---------------------------------------------------------------------------

/** Per-turn overrides allowed on `message()`. Spec §4.2 / §9 (HarnessOverrides). */
export interface MessageOverrides {
  /** Override the model id for just this turn. Falls back to session model. */
  model?: string;
  /** Override the active mode for this turn. Must reference a known mode id. */
  mode?: string;
  /**
   * Tools layered on top of the session's effective tool surface for this
   * turn. Merge-only — the session's own tools stay. Mirrors
   * `HarnessMode.additionalTools` semantics.
   */
  additionalTools?: ToolsInput;

  /**
   * Optional per-turn tool preparation hook forwarded to the backing agent.
   * Runtime compatibility layers use this to adjust the model-visible tool
   * surface without changing persisted mode config.
   */
  prepareStep?: AgentExecutionOptionsBase<unknown>['prepareStep'];

  /** Optional per-turn maximum number of agent execution steps. */
  maxSteps?: AgentExecutionOptionsBase<unknown>['maxSteps'];

  /** Optional per-turn stop condition. */
  stopWhen?: AgentExecutionOptionsBase<unknown>['stopWhen'];

  /**
   * Auto-approve tool-approval interrupts for this turn. Runtime adapters
   * also commonly mirror a persistent `state.yolo === true` setting into the
   * session state; the session treats either source as approval opt-out.
   */
  yolo?: boolean;
}

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Omit<T, Keys> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Omit<Pick<T, Keys>, K>>;
  }[Keys];

export type HarnessMessageContentPart =
  | { type: 'text'; text: string }
  | ({
      type: 'image';
      mediaType?: string;
    } & RequireAtLeastOne<
      {
        image?: unknown;
        image_url?: string | { url: string; detail?: string };
      },
      'image' | 'image_url'
    >)
  | ({
      type: 'file';
      mediaType?: string;
      mimeType?: string;
    } & RequireAtLeastOne<
      {
        data?: string;
        file?: unknown;
        url?: string;
      },
      'data' | 'file' | 'url'
    >)
  | ({
      type: 'tool-call';
      args?: unknown;
    } & RequireAtLeastOne<
      {
        toolCall?: unknown;
        toolCallId?: string;
        toolName?: string;
      },
      'toolCall' | 'toolCallId' | 'toolName'
    >)
  | ({
      type: 'tool-result';
      toolName?: string;
      isError?: boolean;
    } & RequireAtLeastOne<
      {
        toolResult?: unknown;
        toolCallId?: string;
        result?: unknown;
      },
      'toolResult' | 'toolCallId' | 'result'
    >)
  | { type: 'reasoning'; reasoning: string };

/**
 * Common fields shared by every `message()` call.
 */
interface MessageOptionsBase extends MessageOverrides {
  /** Free-form user content. The only required field. */
  content: string | HarnessMessageContentPart[];

  /** Optional idempotency key for retry-safe signal-driven messages. */
  admissionId?: string;

  /** Optional pre-uploaded attachments to include with the user message. */
  attachments?: AttachmentRef[];

  /**
   * Forwarded to the underlying agent run. Lets callers cancel from outside
   * without invoking `session.abort()`. Combined internally with the
   * harness's own abort plumbing.
   */
  abortSignal?: AbortSignal;
}

/** Default shape: returns a fully-resolved `AgentResult`. */
export interface MessageOptionsDefault extends MessageOptionsBase {
  stream?: false;
  output?: undefined;
  sync?: undefined;
}

/** Streaming shape: caller wants the live `MastraModelOutput`. */
export interface MessageOptionsStream extends MessageOptionsBase {
  stream: true;
  output?: undefined;
  sync?: undefined;
}

/**
 * Structured-output shape: returns a parsed object matching `output`.
 * `sync: true` is required — typed output needs a clean turn boundary, so
 * this path is fail-fast on a busy session (spec §4.2). Any Standard-Schema
 * value is accepted; we type against zod here for ergonomics in tests.
 */
export interface MessageOptionsStructured<S extends z.ZodTypeAny> extends MessageOptionsBase {
  output: S;
  sync: true;
  stream?: false;
}

export type MessageOptions<S extends z.ZodTypeAny = z.ZodTypeAny> =
  | MessageOptionsDefault
  | MessageOptionsStream
  | MessageOptionsStructured<S>;

/**
 * Result returned by `message()` in its default (non-streaming, non-typed)
 * form. Currently a thin alias for the agent runtime's `FullOutput`. We
 * keep it as a named export so the harness can layer harness-only fields
 * (e.g., signalId, queuedItemId, harness-managed warnings) here later
 * without breaking callers.
 */
export type AgentResult<OUTPUT = undefined> = FullOutput<OUTPUT>;

/** Shorthand for the streaming return type. */
export type AgentStream<OUTPUT = undefined> = MastraModelOutput<OUTPUT>;

export interface MessageAdmissionResult {
  accepted: true;
  signalId: string;
  runId?: string;
  duplicate: boolean;
}

export interface QueueAdmissionResult {
  accepted: true;
  queuedItemId: string;
  duplicate: boolean;
}

export interface InboxResponseOptions {
  itemId?: string;
  responseId?: string;
}

export interface InboxResponseResult {
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  status: 'accepted' | 'applied';
  responseId: string;
  duplicate: boolean;
}

// ---------------------------------------------------------------------------
// queue() — wait-for-idle FIFO turn queue (spec §4.2 / §6).
//
// Semantics summary:
//   * Items append to `pendingQueue` (durable, ordered, capped by
//     `sessions.maxQueueDepth`). Capacity check + append are atomic.
//   * `additionalTools` is intentionally absent — closures can't survive
//     persistence, and per-turn tool surfaces work via `mode` overrides.
//   * Drain runs head-of-line when the session reaches a clean idle
//     boundary; each item runs as a fresh turn with its overrides applied.
//   * Promise resolves with the eventual `AgentResult` (success or failure)
//     once the head turn fully ends — including any suspend → resume cycles.
// ---------------------------------------------------------------------------

/**
 * Per-turn overrides that survive persistence (a strict subset of
 * `MessageOverrides`).
 */
export interface QueueOverrides {
  /** Override the model id for this queued turn. Falls back to session model. */
  model?: string;
  /** Override the active mode for this queued turn. Must be a known mode id. */
  mode?: string;
  /**
   * If `true`, auto-grant any tool-approval interrupts raised during this
   * queued turn. Mirrors `HarnessOverrides.yolo`. Persisted on the queued
   * item so it survives crash replay.
   */
  yolo?: boolean;
}

/** Options accepted by `Session.queue(...)`. */
export interface QueueOptions extends QueueOverrides {
  /** Free-form user content. The only required field. */
  content: string;

  /** Optional idempotency key for retry-safe queue admission. */
  admissionId?: string;

  /** Optional pre-uploaded attachments to include with the user message. */
  attachments?: AttachmentRef[];
}

/**
 * Options accepted by `Session.listMessages(...)` (spec §4.2, §4.4).
 *
 * `limit` caps the result to the most recent N messages, still returned
 * oldest-first within that window. Omitting `limit` returns the full
 * thread history.
 *
 * Cursor pagination, role filters, and content-type partitioning are
 * deferred to v1.x — current consumers only need a recent-N readback.
 */
export interface ListMessagesOptions {
  limit?: number;
}

// ---------------------------------------------------------------------------
// session.signal() / session.injectSystemReminder() — spec §4.2.
//
// `signal()` is the optimistic user-message primitive: it resolves with
// the routing decision (runId + willInterleave) on the first await tick
// so callers can render an optimistic transcript row before the turn
// completes, then await `result` for the eventual `AgentResult`.
//
// `injectSystemReminder()` is the system-reminder injection primitive used
// by goal-judge continuations and other harness-internal nudges. System
// reminders don't get their own `agent_start`/`agent_end` — if they drain
// into an active run they're absorbed into that run's events, if they wake
// a new run the new run's lifecycle events cover them.
// ---------------------------------------------------------------------------

/** Options accepted by `Session.signal(...)`. */
export interface SessionSignalOptions {
  /** Free-form user content. Matches `message().content`. */
  content: string | HarnessMessageContentPart[];

  /** Optional caller-supplied signal id for optimistic host UI reconciliation. */
  signalId?: string;

  /** Per-turn mode override (same semantics as `message().mode`). */
  mode?: string;

  /**
   * Tools layered on top of the session's effective tool surface for this
   * turn. Mirrors `message().additionalTools` semantics.
   */
  additionalTools?: ToolsInput;

  /** Attributes merged onto the signal when it drains into an active run. */
  ifActive?: {
    attributes?: AgentSignalAttributes;
  };

  /** Attributes merged onto the signal when it wakes an idle run. */
  ifIdle?: {
    attributes?: AgentSignalAttributes;
  };

  /**
   * Forwarded to the underlying agent run when the signal wakes a fresh
   * idle run. Ignored on active-delivery (the in-flight run already has
   * its own abort controller).
   */
  abortSignal?: AbortSignal;
}

/** Result returned by `Session.signal(...)` (resolved on the first await tick). */
export interface SessionSignalResult {
  /** Stable signal id — keys the optimistic transcript row. */
  id: string;

  /** Run id the signal landed on (existing run on active-delivery, fresh run on idle-wake). */
  runId: string;

  /**
   * `true` iff dispatched into an already-active run on this thread. UIs
   * use this to decide pending-row vs regular-row rendering.
   */
  willInterleave: boolean;

  /** Always `true` — admission is synchronous on the agent layer. */
  accepted: true;

  /** Raw signal envelope (carries `id`, `createdAt`, etc.). */
  signal: CreatedAgentSignal;

  /**
   * Resolves when the containing run completes. On active-delivery this is
   * the existing run's completion promise (shared across all signals on
   * the run); on idle-wake it's the freshly-woken run.
   */
  result: Promise<AgentResult>;
}

/** Options accepted by `Session.injectSystemReminder(...)`. */
export interface SessionInjectSystemReminderOptions {
  /** Optional structured attributes carried on the signal envelope. */
  attributes?: Record<string, string | number | boolean | null | undefined>;

  /** Optional opaque metadata carried on the signal envelope. */
  metadata?: Record<string, unknown>;
}

/** Result returned by `Session.injectSystemReminder(...)` (resolved on the first await tick). */
export interface SessionInjectSystemReminderResult {
  /** Stable signal id. */
  id: string;

  /** Run id the reminder landed on (existing or freshly-woken). */
  runId: string;

  /** `true` iff dispatched into an already-active run on this thread. */
  willInterleave: boolean;

  /** Always `true` — admission is synchronous on the agent layer. */
  accepted: true;

  /** Raw signal envelope. */
  signal: CreatedAgentSignal;
}

/**
 * Pass-through of the agent's own execution options for the rare case a
 * caller needs to drop down to the raw surface. Most callers should stay on
 * `MessageOptions`.
 */
export type RawAgentExecutionOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT>;

// ---------------------------------------------------------------------------
// HarnessRequestContext (§6.1).
//
// Tools authored for the harness reach this slot via:
//   const ctx = context.requestContext.get('harness') as HarnessRequestContext;
// Spec §6 is the contract for the slot.
// ---------------------------------------------------------------------------

/**
 * `setState` is overloaded:
 *  - Object form does a shallow merge into the current state.
 *  - Function form runs an atomic read-modify-write — the harness reads the
 *    live state at call time, passes it to the updater, persists the return.
 *    The updater MUST be synchronous; async work should happen first, then
 *    the resolved value goes into a fresh setState call.
 */
export type SetStateFn<TState> = {
  (updates: Partial<TState>, opts?: SetStateOptions): Promise<void>;
  (updater: (prev: TState) => TState, opts?: SetStateOptions): Promise<void>;
};

export interface SetStateOptions {
  /**
   * Optional optimistic validator for remote state patches. When supplied,
   * the update is rejected unless the latest serialized session version still
   * matches this value at the state-mutation queue point.
   */
  ifVersion?: number;
}

/** Parameters accepted by `ctx.registerQuestion(...)` from a suspending tool. */
export interface RegisterQuestionParams {
  questionId: string;
  question: string;
  options?: Array<{ label: string; description?: string }>;
  selectionMode?: 'single_select' | 'multi_select';
  runId?: string;
  toolCallId?: string;
}

/** Parameters accepted by `ctx.registerPlanApproval(...)` from a suspending tool. */
export interface RegisterPlanApprovalParams {
  planId: string;
  title?: string;
  plan: string;
}

/**
 * Harness-specific context surfaced on the agent's `RequestContext` under
 * the `'harness'` key. See spec §6 for the full contract.
 *
 * For the parent session: `subagentDepth: 0`, `source: 'parent'`,
 * `parentSessionId` and `subagentToolCallId` undefined.
 * For a subagent: depth ≥ 1, `source: 'subagent'`, parent linkage populated.
 */
export interface HarnessRequestContext<TState = unknown> {
  /** Harness instance id. Useful for log correlation across processes. */
  harnessId: string;
  /** The session this tool invocation runs against. Stable for the call's lifetime. */
  sessionId: string;
  /** The thread the session is bound to. Stable for the call's lifetime. */
  threadId: string;
  /** The resource the session is scoped to. Stable for the call's lifetime. */
  resourceId: string;

  /** Resolved mode id for this turn (with any per-turn overrides applied). */
  modeId: string;
  /** Effective model id for this turn, when one has been selected. */
  modelId?: string;

  /** Caller-provided application metadata after durable JSON normalization. */
  app?: Readonly<Record<string, JsonValue>>;

  /** Trusted channel metadata attached by Harness-owned integration paths. */
  channel?: Readonly<PersistedRequestContextInput['channel']>;

  /** Snapshot of session state at slot construction. Live reads use `getState`. */
  state: TState;
  /** Returns the live state object, reflecting writes from earlier in the same turn. */
  getState: () => TState;
  /** Persisted shallow merge (object form) or atomic read-modify-write (functional form). */
  setState: SetStateFn<TState>;
  /**
   * Legacy-compatible atomic state helper. Kept on the v1 request-context slot
   * so shared Harness tools can mutate state and emit turn events without
   * depending on a specific Session implementation.
   */
  updateState?: <TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: Array<Record<string, unknown>>; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: Array<Record<string, unknown>>; result: TResult }>,
  ) => Promise<TResult>;
  /** Emit a Harness turn event from a tool. Primarily used by shared built-ins. */
  emitEvent?: (event: Record<string, unknown>) => void;

  /** Turn abort signal. Fires for the four reasons enumerated in §4.5. */
  abortSignal: AbortSignal;

  /** Register a pending question (used by `ask_user` and custom suspending tools). */
  registerQuestion: (params: RegisterQuestionParams) => Promise<void>;
  /** Register a pending plan approval (used by `submit_plan` and custom suspending tools). */
  registerPlanApproval: (params: RegisterPlanApprovalParams) => Promise<void>;
  /**
   * Resolve the Harness permission policy for one tool invocation. The agent
   * tool dispatcher calls this before execution so per-tool/category rules and
   * session grants can allow, ask, or deny without degrading to a global
   * approval gate.
   */
  resolveToolPermission?: (params: { toolName: string; args: Record<string, unknown> }) => PermissionPolicy;
  /**
   * Internal audit hook used by the agent tool dispatcher to journal
   * workspace actions after the final permission decision is known.
   */
  recordWorkspaceAction?: (params: {
    toolName: string;
    args: Record<string, unknown>;
    policyDecision: PermissionPolicy;
    runId?: string;
    toolCallId?: string;
    result?: unknown;
    error?: unknown;
  }) => Promise<void>;

  /** Depth of the session in the subagent tree. `0` for the parent. */
  subagentDepth: number;
  /** `'parent'` for the top session, `'subagent'` for any descendant. */
  source: 'parent' | 'subagent';
  /** Parent session id when `source === 'subagent'`. */
  parentSessionId?: string;
  /** Tool call id of the subagent invocation when `source === 'subagent'`. */
  subagentToolCallId?: string;

  /**
   * Subagent model resolver — returns the configured model id for a given
   * agent type, or `null` to fall back to the session's default model.
   */
  getSubagentModel: (params?: { agentType?: string }) => string | null;

  /**
   * Workspace handle (§6.1). Only present when the harness is configured
   * with a workspace and the session has resolved (or can lazily resolve)
   * one. Tools should null-check before use.
   */
  workspace?: Workspace;

  /**
   * Register a background sandbox process so the Harness can reap it when
   * the session is closed, evicted, or deleted. Tools that call
   * `sandbox.processes.spawn(...)` for background mode (i.e. processes
   * that outlive the spawning turn) should pass the resulting handle
   * here. Returns an `unregister()` callback the tool MAY call explicitly,
   * though the harness also auto-unregisters via `handle.wait()` on
   * normal exit. Optional: tools must null-check before calling.
   *
   * Foreground commands need NOT register — they already terminate when
   * the turn's `abortSignal` fires via the sandbox process manager's
   * built-in abort-to-kill wiring.
   */
  registerBackgroundProcess?: (handle: ProcessHandle) => () => void;

  /**
   * Extend this session's storage lease so the current Harness retains
   * ownership for at least `ttlMs` ms beyond `Date.now()`. Tools that
   * KNOW they will block the event loop or exceed the default lease TTL
   * should call this BEFORE the blocking work — the periodic heartbeat
   * alone cannot guarantee renewal under starvation. The value is clamped
   * upward to the default lease TTL so this call never shrinks an
   * existing lease. Rejects on non-finite / non-positive / non-integer
   * `ttlMs` and on values above the safety cap. Optional: tools must
   * null-check before calling.
   */
  extendLease?: (opts: { ttlMs: number }) => Promise<void>;

  /**
   * Invoke a skill programmatically from inside a tool. Delegates to
   * `session.skills.use(ref, opts)` against the owning session, sharing its
   * code/workspace resolution, args validation, prompt construction, and turn
   * dispatch. See spec §4.6.
   */
  useSkill: (ref: string, opts?: UseSkillOptions) => Promise<AgentResult>;
}

// ---------------------------------------------------------------------------
// Goals (§4.7).
// ---------------------------------------------------------------------------

/**
 * Options accepted by `Session.setGoal(...)`. `objective` is the only
 * required field. `judgeModel` and `maxTurns` fall back to the harness's
 * `goals.defaultJudgeModel` / `goals.defaultMaxTurns` (in turn defaulting
 * to the session's current model and `50` respectively).
 *
 * `kickoff` controls whether `setGoal` immediately enqueues an initial
 * continuation turn so the agent starts working toward the goal without
 * an explicit `message()` from the caller. Defaults to `true`.
 */
export interface GoalOptions {
  objective: string;
  judgeModel?: string;
  maxTurns?: number;
  kickoff?: boolean;
}
