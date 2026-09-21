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
import type { LogicalMessageIdentity, LogicalMessageSignalIdentity } from '../../agent/message-list';
import type { CreatedAgentSignal } from '../../agent/signals';
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
  ChannelBinding,
  ChannelDeliverySemantics,
  ChannelInboxItem,
  ChannelOutboxEnqueueOptions,
  ChannelOutboxItem,
  ChannelOutboxOperationKind,
  ChannelProviderDeliveryReceipt,
  HarnessAttachmentKind,
  HarnessPrimitiveType,
  PersistedRequestContextInput,
  HarnessStorage,
  JsonValue,
  PendingResume,
  PermissionRules,
  QueuedItem,
  SessionRecord as StoredSessionRecord,
} from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';
import type { GoalEvaluationPayload } from '../../stream/types';
import type { Workspace } from '../../workspace';
import type { RequestContextInput } from './request-context-input';
import type { Session } from './session';
import type { WorkspaceProvider, WorkspaceProviderContext } from './workspace-provider';

// ---------------------------------------------------------------------------
// Public message projection (§11.1).
//
// Harness owns this flattened, renderer-oriented projection. AgentController
// now exposes canonical MastraDBMessage rows directly, so keeping these types
// here prevents the durable Harness contract from leaking back into the
// AgentController API.
// ---------------------------------------------------------------------------

export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: HarnessMessageContent[];
  createdAt: Date;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  stopReason?: 'complete' | 'tool_use' | 'aborted' | 'error';
  errorMessage?: string;
}

export type HarnessMessageContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | {
      type: 'tool_result';
      id: string;
      name: string;
      result: unknown;
      isError: boolean;
      providerMetadata?: Record<string, unknown>;
    }
  | {
      type: 'system_reminder';
      message: string;
      reminderType?: string;
      path?: string;
      precedesMessageId?: string;
      gapText?: string;
      gapMs?: number;
      timestamp?: string;
      goalMaxTurns?: number;
      judgeModelId?: string;
      goalEvaluation?: GoalEvaluationPayload;
    }
  | {
      type: 'state_signal';
      id?: string;
      stateId: string;
      mode: 'snapshot' | 'delta';
      cacheKey?: string;
      version?: number;
      message: string;
    }
  | {
      type: 'reactive_signal';
      id?: string;
      tagName: string;
      message: string;
      attributes?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'notification_summary';
      id?: string;
      message: string;
      pending: number;
      bySource: Record<string, number>;
      byPriority: Record<string, number>;
      notificationIds: string[];
    }
  | {
      type: 'notification';
      id?: string;
      notificationId?: string;
      message: string;
      source?: string;
      kind?: string;
      priority?: string;
      status?: string;
      attributes?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'file'; data: string; mediaType: string; filename?: string }
  | {
      type: 'om_observation_start';
      tokensToObserve: number;
      operationType?: 'observation' | 'reflection';
    }
  | {
      type: 'om_observation_end';
      tokensObserved: number;
      observationTokens: number;
      durationMs: number;
      operationType?: 'observation' | 'reflection';
      observations?: string;
      currentTask?: string;
      suggestedResponse?: string;
    }
  | {
      type: 'om_observation_failed';
      error: string;
      tokensAttempted?: number;
      operationType?: 'observation' | 'reflection';
    }
  | { type: 'om_thread_title_updated'; threadId: string; oldTitle?: string; newTitle: string };

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
   * Whether Harness-owned built-ins (plan-task tools and `spawn_subagent` when
   * configured) are included in this mode. Defaults to `include`.
   */
  harnessBuiltins?: 'include' | 'exclude';

  /**
   * Optional plan→build target. When `submit_plan` runs in this mode, the
   * registered `PendingResume` freezes this value as `transitionModeId`.
   * On approval, the session flips to this mode
   * idempotently (§5.1, §5.7). If unset, plan approval resumes with no
   * mode change. Must reference another mode's `id`.
   */
  transitionsTo?: string;

  /**
   * Base permission policy this mode establishes (§4.2e). When set, ENTERING the
   * mode — session create, `switchMode`, or a plan-approval `transitionsTo` flip —
   * seeds the session's `permissionRules` with a copy of this policy: the mode
   * owns the base. Runtime `session.permissions.setPolicy()` and grants overlay it
   * until the next mode entry re-establishes the base. Modes that omit this field
   * leave the session's existing rules untouched (opt-in, backward compatible).
   *
   * This governs the permission GATE (allow/ask/deny at call time). It is
   * orthogonal to the workspace, which stays owned by the session/resource.
   */
  permissions?: PermissionRules;

  /**
   * Optional workspace tool profile: the workspace tool CATEGORIES
   * (`read` / `edit` / `execute`) this mode EXPOSES on the HARNESS-CONTROLLED tool
   * surface — `mode.tools`, `mode.additionalTools`, and per-call `additionalTools`.
   * A tool in those toolsets whose resolved category (via
   * `HarnessConfig.toolCategoryResolver`) is a workspace category NOT listed in
   * `expose` is withheld from the model; `mcp` / `other` / uncategorized tools and
   * the harness built-ins pass through. Without a `toolCategoryResolver` nothing is
   * filtered.
   *
   * SCOPE: this filters only what the harness injects via toolsets. The backing
   * agent's OWN tools and provider-supplied workspace tools are assembled by the
   * agent downstream and are governed by the permission policy (`permissions`
   * above — e.g. a category `deny`), not by this exposure profile.
   *
   * This never touches the workspace itself. The durable world (files, sandbox,
   * browser, provider resume state) stays tied to the session/resource ownership
   * model and is unchanged across mode switches.
   */
  workspaceTools?: { expose: ToolCategory[] };

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

export type HarnessQueueBackpressurePolicy = 'reject' | 'drop-oldest';

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
// §14.2 ingress delivery mode. `signal` interleaves the inbound into an active
// run (or wakes a fresh one) sharing the run terminal (§21); `queue` appends a
// sequential durable turn boundary. The canonical token is `signal` — it matches
// the §14 spec surface (ChannelIngressOptions/Result) and the
// `channel_ingress_admitted` event — superseding the earlier `message` spelling.
export type ChannelIngressDelivery = 'signal' | 'queue';
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

/**
 * §13.2/§14.2: transport-neutral result of `harness.handleChannelInboundRequest`.
 * The core bridge owns registry resolution, provider verification, the §13.6
 * readiness gate, and durable admission; the @mastra/server route is a thin
 * transport mapper that turns this into an HTTP response/error envelope.
 *
 * On `kind: 'ok'`, `ackStatus` is the success HTTP status — `202` for a record-only
 * ACK (the durable `received` row exists; a recovery worker finishes admission),
 * `200` once admission reached `queued`/`accepted` or for an idempotent duplicate.
 * Failure variants carry the HTTP status and the §13.3 error envelope shape.
 */
export type HarnessChannelInboundResult =
  | {
      kind: 'ok';
      ackStatus: 200 | 202;
      inboxItemId: string;
      status: ChannelInboxItem['status'];
      duplicate: boolean;
      binding?: ChannelBinding;
      sessionId?: string;
      queuedItemId?: string;
    }
  | {
      kind: 'not_found' | 'verify_failed' | 'not_ready' | 'conflict';
      httpStatus: 400 | 401 | 404 | 409 | 503;
      error: { code: string; message: string; details?: Record<string, unknown>; retryable?: boolean };
    };

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
  /**
   * Namespaced `harness.*` wire code (§13.3f.1). The bare `HarnessRowErrorCode`
   * stored on the row is projected to this public form before it crosses the
   * wire; `reason` carries the originating bare code when several collapse onto
   * one envelope.
   */
  code: string;
  reason?: string;
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
  /**
   * Maximum JSON-serialized byte size for a single emitted tool-event payload
   * (`tool_start.input`, `tool_end.output`, approval/suspension data). A payload
   * exceeding this is replaced AT EMIT by the stable oversized-payload sentinel
   * so the durable event ledger and the live wire stay bounded while live and
   * replay remain identical. Defaults to 64 KiB so normal model-generated tool
   * results are untouched while an unconfigured Harness remains bounded. Must
   * be a non-negative integer.
   */
  maxEventPayloadBytes?: number;
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
export type HarnessActionCatalogSourceKind = 'skill' | 'mcp-server' | 'mcp-tool';

export interface HarnessActionCatalogSkillSource {
  kind: 'skill';
  /** Canonical ref usable with `session.skills.use(ref, ...)`. */
  ref: string;
  /** Skill name, useful for display and grouping. */
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

export interface HarnessActionCatalogMcpServerSource {
  kind: 'mcp-server';
  /** Registered MCP server key. */
  serverKey: string;
}

export type HarnessActionCatalogSource =
  | HarnessActionCatalogSkillSource
  | HarnessActionCatalogMcpServerSource
  | HarnessActionCatalogMcpToolSource;

export type HarnessActionCatalogEntryStatus = 'available' | 'unavailable' | 'auth_required' | 'permission_denied';

export type HarnessActionCatalogUnavailableReason =
  | 'mcp_tool_catalog_failed'
  | 'mcp_tool_catalog_timeout'
  | 'mcp_tool_catalog_retry_suppressed';

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
  status: HarnessActionCatalogEntryStatus;
  /** Stable machine-readable reason for unavailable or gated entries. */
  statusReason?: HarnessActionCatalogUnavailableReason;
  /** Safe display summary for unavailable or gated entries. */
  statusMessage?: string;
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

  /**
   * Caller-supplied request context for the skill run (§4.4c). Only `app` may
   * be set (see {@link MessageOverrides.requestContext}); other keys are
   * rejected before the skill turn starts.
   */
  requestContext?: RequestContextInput;
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
 *      a child of a `Mastra` instance (`new Mastra({ harness })` for a
 *      default harness, or `new Mastra({ harnesses: { ... } })` for named
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
         * registration (`new Mastra({ harness })` or `new Mastra({ harnesses })`).
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
   * `harness.runtime_drift` if replay/resume observes a different
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
     * Persist the high-volume transient streaming events (`text_delta`,
     * `subagent_text_delta`) to the durable session-event log. Defaults to
     * `true` (every emitted event is persisted, backing storage-based SSE
     * `Last-Event-ID` replay). Set `false` to skip persisting these per-token
     * deltas — a large write reduction for streaming-heavy workloads (a 2000-token
     * response drops ~2000 `appendSessionEvent` writes). §10.5: durable
     * `text_delta` replay across restarts is explicitly NOT a goal and the
     * cold-start snapshot does not synthesize missed deltas, so this is
     * spec-aligned. With it off, a reconnect whose `Last-Event-ID` precedes a
     * skipped delta gets a 412 `unreplayable_gap` and recovers via the session
     * snapshot + message log (the §10.5-sanctioned path); live subscribers still
     * receive every delta in real time. Recommended `false` when the UI reads
     * from a separate read-model (e.g. Convex) rather than the harness SSE stream.
     */
    persistTransientStreamingEvents?: boolean;

    /**
     * Maximum number of items allowed to wait in `pendingQueue` per session.
     * `session.queue(...)` rejects with `HarnessQueueFullError` when full.
     * Capacity check + durable append are atomic per session. Defaults to 100.
     */
    maxQueueDepth?: number;

    /**
     * Queue-full behavior. `reject` preserves the historical behavior and
     * throws `HarnessQueueFullError` when the session queue is full.
     * `drop-oldest` removes the oldest waiting queued item and records a
     * `queue_full_dropped` event before admitting the replacement. The active
     * queued head is never dropped by backpressure.
     */
    queueBackpressure?: HarnessQueueBackpressurePolicy;

    /**
     * Milliseconds allowed after the durable `closingAt` marker commits for
     * live sessions to drain admitted work before terminal `closedAt`. The
     * runtime persists `closeDeadlineAt = closingAt + closeTimeoutMs` and
     * reuses an existing deadline when repairing a partially completed close.
     * Must be a positive integer. Defaults to 30_000 ms (30s).
     */
    closeTimeoutMs?: number;

    /**
     * Maximum time a tool approval, tool suspension, question, plan approval,
     * or sandbox-access request may wait for a user response. Expiry
     * terminalizes only the suspended run and keeps the session/thread
     * recoverable for future turns. The deadline is stored on the pending row,
     * so restarts do not reset it. Defaults to 600_000 ms (10 minutes).
     */
    pendingInteractionTtlMs?: number;

    /**
     * Per-kind overrides for {@link pendingInteractionTtlMs}. A kind present
     * here uses its own deadline; every other kind keeps the single default.
     * Useful when one gate deserves more patience than the rest — a
     * destructive-action `tool-approval` confirmation is worth waiting longer
     * on than a `sandbox-access` prompt the user can simply re-trigger.
     *
     * Each value has the same bounds as `pendingInteractionTtlMs` and is
     * validated at construction. Only the kind that captured the pending row
     * is consulted, and the resolved deadline is frozen onto that row, so a
     * config change never moves an already-parked interaction's deadline.
     */
    pendingInteractionTtlMsByKind?: Partial<Record<PendingResume['kind'], number>>;

    /**
     * Behavior when `harness.session(...)` needs the write lease but another
     * owner holds an unexpired lease (§5.8):
     * - `'fail'` (default): reject immediately with `HarnessSessionLockedError`.
     * - `'wait'`: block up to `lockWaitMs`, re-acquiring once the held lease
     *   expires; throw `HarnessSessionLockedError` only if the wait elapses.
     *   Recommended for SSE/browser-reconnect shapes where the previous lease
     *   has not yet TTL'd out.
     * - `'steal'`: reserved for a future operator fence; not yet implemented and
     *   currently rejected at construction with `HarnessConfigError`.
     */
    lockMode?: 'fail' | 'wait';

    /** Session write-lease TTL in ms (§5.8). Defaults to 30_000 (30s). */
    lockTtlMs?: number;

    /** Keep-alive renewal interval in ms (§5.8). Defaults to 10_000 (10s). */
    lockRenewMs?: number;

    /** Max ms `lockMode: 'wait'` blocks before failing closed. Defaults to 5_000. */
    lockWaitMs?: number;

    /**
     * Cap on hydrated (live) sessions per harness instance (§5.4). Hydrating or
     * creating another session past the cap pressure-evicts the
     * least-recently-active unpinned session; if every live session is pinned
     * (parked on a pending interaction), `harness.session(...)` rejects with
     * `HarnessLiveSessionLimitError`. Defaults to `Infinity` (no cap).
     */
    maxLive?: number;

    /**
     * Auto-evict a live session after this many ms with no activity (§5.4).
     * Skipped while a session has a pending approval/suspension/question/plan.
     * Defaults to 2 hours.
     */
    idleTimeoutMs?: number;

    /**
     * Optional pre-drain hook invoked once per queued item AFTER the drain
     * loop selects it and clears its admission receipt's terminal checks, and
     * BEFORE the turn's permission rule/grant snapshot is captured for
     * `_resolveToolPolicy` (§4.2e). Intended for converging external durable
     * authorization state (for example owner-scoped grant stores) onto the
     * live session record so a grant revoked or expired after queue admission
     * cannot ride a stale `sessionGrants` copy into tool execution.
     *
     * The hook is awaited before any dispatch path (terminal-evidence
     * recovery, admitted-dispatch recovery, or fresh admission). It fires on
     * every drain attempt of the item — including retries after deferral —
     * so it must be idempotent. Grant mutations made through
     * `session.permissions.*` commit durably under the session lease and are
     * visible to the snapshot the same turn builds.
     *
     * Fail-closed semantics: throwing `HarnessQueuedTurnDeferredError` parks
     * the item in place and retries at its `retryAt` without consuming the
     * receipt's attempt budget; any other error fails the item permanently
     * via the normal queue-failure path. The hook does not run for
     * `session.message()` turns or for `completed`/`failed`/`dead` receipts.
     * When unset, drain behavior is unchanged.
     */
    onBeforeQueuedTurn?: (opts: { session: Session; item: QueuedItem }) => Promise<void>;

    /**
     * Awaited per-tool hook invoked at the action-time permission gate on
     * every tool call the turn is about to execute — after the synchronous
     * snapshot policy resolves and before approval resolution and `execute()`.
     * It exists so integrations can revalidate authorization against durable
     * state that may have changed since the turn's permission snapshot was
     * captured (e.g. an owner-scoped grant revoked or expired mid-turn).
     *
     * `policyDecision` is the snapshot policy's verdict for the tool
     * (`undefined` when the §4.2e permission gate is not engaged), so the
     * hook can cheap-return when the snapshot already resolves `ask`/`deny`
     * and no grant-derived authorization needs revalidation. Returning
     * `'deny'` blocks the call through the same auditable `tool_denied` path
     * as a policy deny; `'allow'`/`void` defers to the normal gates.
     * Throwing or returning an unrecognized value fails closed as `'deny'`.
     *
     * The hook fires for every tool call on every session — including
     * subagent sessions — so implementations that govern only a subset of
     * tools or only root sessions must cheap-return early for calls they do
     * not own. Because the gate awaits the hook, implementations must bound
     * their own IO — a never-settling hook stalls the tool call the same way
     * a never-settling tool `execute()` would. When unset, tool execution is
     * unchanged.
     */
    onBeforeToolExecution?: (opts: {
      session: Session;
      toolName: string;
      toolCallId?: string;
      args?: unknown;
      isResume?: boolean;
      policyDecision?: 'allow' | 'ask' | 'deny';
    }) => 'allow' | 'deny' | void | Promise<'allow' | 'deny' | void>;
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
   *
   * `maxConcurrent` caps how many inline (`spawn_subagent`) plus durable
   * (`task_delegate`) subagents a single parent session may have in flight at
   * once. Both paths consume the same reservation; selecting durable delegation
   * cannot bypass backpressure. A call at the cap returns a tool error
   * (`HarnessSubagentConcurrencyLimitError`) before creating a child session.
   * Omitted ⇒ no per-parent limit (still bounded harness-wide by
   * `sessions.maxLive`).
   *
   * `delegationTimeoutMs` is the wall-clock budget for one durable
   * `task_delegate` attempt, including provider work and any HITL wait. The
   * resulting absolute deadline is committed with the ownership edge and is
   * never reset by process restart. Default: 30 minutes.
   */
  subagents?: {
    /**
     * Exact top-level observability-lineage keys from a parent turn's
     * caller-supplied `app` request context that may be copied into inline and
     * durable descendant turns.
     * Keys are matched literally (not as dotted paths), and every other app
     * field remains isolated. The selected JSON values are copied rather than
     * sharing object identity with the parent.
     * The complete selected bag is capped at 256 canonical JSON UTF-8 bytes.
     *
     * Selected keys are also exposed as top-level entries on the descendant's
     * agent `RequestContext` so observability integrations can correlate nested
     * provider calls without inspecting the complete application metadata bag.
     * Infrastructure-owned keys and `app` itself are rejected at construction.
     * Do not configure instruction, identity, authorization, entitlement, or
     * tool-behavior keys; use a dedicated opaque correlation value instead.
     * Defaults to `[]` (no request-context inheritance).
     */
    inheritRequestContextAppKeys?: string[];
    /**
     * Copy the root session's durable tool/category grants into each newly
     * created descendant session. The copy is a creation-time snapshot: it
     * does not share mutable permission state and never updates descendants
     * that are already running. Per-tool/category `deny` rules and subagent
     * tool allowlists remain stronger than an inherited grant.
     *
     * Defaults to `false`, preserving isolated subagent permission state.
     */
    inheritRootSessionGrants?: boolean;
    maxDepth?: number;
    maxConcurrent?: number;
    delegationTimeoutMs?: number;
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
   * `new Mastra({ channels, harness })` / `new Mastra({ channels, harnesses })`
   * so provider bindings exist.
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

  /**
   * §9.2 Observational Memory. JSON-safe resolved defaults for OM in this
   * harness. Runtime enablement and per-session model switching are currently
   * blocked on native @mastra/memory engine selection, so enabled configuration
   * and switch calls reject instead of silently dropping message history. The
   * `session.om.clearOverride()` recovery surface removes unsupported intent
   * persisted by older builds. Until native selection lands, configure OM on the
   * Agent Memory instance and omit this option. Raw observation rows remain
   * advisory MemoryStorage data outside the session lease/CAS boundary (§5.2).
   */
  observationalMemory?: ObservationalMemoryConfig;

  // Remaining fields (files, intervals) land here as we wire them up.

  [key: string]: unknown;
}

/**
 * §9.2 — retained JSON-safe validation surface for Harness Observational Memory.
 * `false`, omission, or `{ enabled: false }` keeps Harness OM disabled. Every
 * enabled form currently rejects because @mastra/memory cannot select an OM
 * engine from the effective per-turn config. Configure OM directly on the
 * Agent's Memory instance instead. The remaining fields are validated so callers
 * receive precise malformed-input errors; they do not enable Harness OM.
 */
export type ObservationalMemoryConfig =
  | boolean
  | {
      /** `false` disables OM; omitted requests unsupported enablement and rejects. */
      enabled?: boolean;
      /**
       * Creation-time lookup scope for OM records. Defaults to `'thread'`.
       * `'resource'` is an explicit privacy/authorization choice — snapshots may
       * summarize other threads for the same authenticated resource. Existing
       * sessions never change scope implicitly.
       */
      scope?: 'thread' | 'resource';
      /** Default model id for BOTH observer and reflector. */
      model?: string;
      observation?: {
        /** Observer model id (overrides `model`). */
        model?: string;
        /** Observation trigger threshold (message tokens). */
        messageTokens?: number;
      };
      reflection?: {
        /** Reflector model id (overrides `model`). */
        model?: string;
        /** Reflection trigger threshold (observation tokens). */
        observationTokens?: number;
      };
      /** Opaque adapter-owned OM processor options (JSON-safe only). */
      processorOptions?: Record<string, JsonValue>;
    };

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
  /**
   * Backing agent id. Must reference a key in `HarnessConfig.agents`.
   *
   * NOTE: the subagent session resolves its running agent from its MODE
   * (`mode.agentId`), not from this field directly. When `modeId` is set, it MUST
   * be backed by this same `agentId` (validated at construction). When `modeId` is
   * unset the subagent inherits the PARENT's mode — and therefore the parent
   * mode's agent — so this field is advisory in that case.
   */
  agentId: string;

  /**
   * Mode the subagent's session runs in. Resolves in `HarnessConfig.modes`; its
   * `agentId` must equal this type's `agentId`. If unset, the subagent inherits
   * the parent's current mode (and thus that mode's agent).
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
   * Whether this type may be selected by the synchronous `spawn_subagent`
   * tool. Defaults to `true`. Set this to `false` for a type whose tool surface
   * can park for human input: inline children have no independent resume
   * driver, while `task_delegate` children are durable and resumable.
   *
   * This is an execution-boundary control, not prompt guidance. Disabled types
   * are omitted from the inline tool schema and rejected again at execution.
   * They remain available to durable `task_delegate` calls.
   */
  allowInline?: boolean;

  /**
   * Extra tools layered onto this subagent type's surface, on top of its mode's
   * tools + the harness built-ins (subject to the same workspace-tool profile and
   * permission gate as any other tool). To strictly CONSTRAIN a subagent to a
   * minimal surface, also bind it to a `modeId` whose mode carries that surface
   * and/or use the mode's `permissions` gate — this field augments, it does not
   * hide the backing agent's own tools (which the agent assembles downstream).
   *
   * DURABILITY: this override is applied to the live child session in-memory and
   * is not stored on the child record. For a DELEGATED subagent (`task_delegate`)
   * it IS restored on reattach: the subagent type id is persisted on the plan-task
   * delegation link (`delegatedSubagentTypeId`) and the reattach reconcile
   * re-resolves this definition (`tools` + `workspace`) onto the reloaded child. A
   * `spawn_subagent` child is transient (runs inline, auto-closed) and is not
   * reattached, so its override lives only for that in-process run.
   */
  tools?: ToolsInput;

  /**
   * §SA/M4 — hard capability scope for this subagent: when set, the subagent may
   * call ONLY the model-visible tools whose final exposed NAME is in this list.
   * Enforced at the §4.2e pre-exposure gate (a non-listed tool is removed before
   * the model call AND hard-denied at action time), so it constrains the agent's
   * own tools + MCP tools + the per-turn surface — unlike `tools`, which only
   * augments. HITL/local builtins (ask_user, submit_plan, plan-task tools) are
   * always available; `spawn_subagent` and `task_delegate` are NOT auto-kept — to
   * let a scoped subagent spawn/delegate, list them explicitly (prevents a
   * restricted subagent from escalating via a broader child). Entries are final
   * exposed names (after the agent's name normalization); it is a name allowlist,
   * not a provider/server-identity scope. Restored on a delegated subagent's
   * reattach via `delegatedSubagentTypeId`, like `tools`/`workspace`.
   */
  toolAllowlist?: string[];

  /**
   * Workspace ownership model for the subagent session. `'inherit'` (default)
   * shares the parent's workspace via a refcount on the same registry entry;
   * `'fresh'` provisions the subagent its own per-session workspace (only valid
   * under `workspace.kind: 'per-session'`, validated at construction). This
   * controls FILESYSTEM/sandbox ownership only — it does not reset the
   * subagent's mode, tools, or permissions.
   */
  workspace?: 'inherit' | 'fresh';
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
   * @internal — used by the built-in `spawn_subagent` tool to record the
   * child's depth in the subagent tree (parent + 1). Top-level callers
   * should leave this unset; it defaults to `0`.
   */
  subagentDepth?: number;

  /**
   * @internal — the `subagents.types` key this child is spawned/delegated under
   * (M4). Persisted on the child `SessionRecord` so its per-subagent overrides
   * (tools / workspace / toolAllowlist) survive a direct-by-id hydrate, not only
   * the parent's delegation-reattach. Top-level callers leave this unset.
   */
  subagentTypeId?: string;
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

export type SessionResolveOptions = SessionResolveByThread | SessionResolveById | SessionResolveByIdScoped;

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

export interface SessionLoadByThreadOptions {
  resourceId: string;
  threadId: string;
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
  /** Native identity shared by this input and all response segments it owns. */
  logicalMessageIdentity?: LogicalMessageIdentity;

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
   * Caller-supplied request context for this turn (§4.4c). Only `app` — a
   * canonical-JSON application metadata bag surfaced to tools as
   * `HarnessRequestContext.app` — may be set; any other top-level key is
   * rejected with `HarnessValidationError` before admission. Replaced per
   * turn, never merged. Rejected when the turn would interleave into an
   * already-active run (it could not become tool-visible there).
   */
  requestContext?: RequestContextInput;

  /**
   * Per-turn model generation settings (temperature, maxTokens, topP, …)
   * applied on top of the resolved mode/model defaults for this turn. Mirrors
   * {@link AgentExecutionOptionsBase.modelSettings}. Honored by structured
   * sync turns and idle signal-routed turns; falls through to the
   * model/provider defaults when unset, so omitting it preserves existing
   * behavior. Does not change model selection — use
   * {@link MessageOverrides.model} for that.
   */
  modelSettings?: AgentExecutionOptionsBase<unknown>['modelSettings'];
}

/**
 * Common fields shared by every `message()` call.
 */
/**
 * Ordered internal phases of `session.message()` admission, reported through
 * `MessageOptionsBase.onPhase`. Each fires once, immediately after its step
 * settles, so callers can attribute pre-stream latency to duplicate fencing,
 * context/instruction resolution, durable evidence writes, and agent dispatch
 * without wrapping or re-implementing the harness pipeline.
 */
export type MessageAdmissionPhase =
  | 'admission_duplicate_resolved'
  | 'tool_surface_built'
  | 'request_context_ready'
  | 'evidence_reserved'
  | 'agent_dispatched'
  | 'output_registered';

interface MessageOptionsBase extends MessageOverrides {
  /** Free-form user content. The only required field. */
  content: string;

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

  /**
   * Observability-only phase callback for the pre-stream admission pipeline.
   * Failures inside the callback are swallowed; it must never affect turn
   * semantics.
   */
  onPhase?: (phase: MessageAdmissionPhase, elapsedMs: number) => void;
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

type InboxResponsePolicyOptions = {
  /**
   * Tool approvals only. `once` resumes only the current invocation; `always`
   * atomically grants the exact tool for the lifetime of this session while
   * admitting the response. Defaults to `once`.
   */
  approvalScope?: 'once' | 'always';
  // NOTE (§4.4c): inbox responses are also a fresh entry point that may carry a
  // caller `requestContext.app`. Wiring it correctly requires including the
  // normalized DTO in the response-admission hash (so duplicate `responseId`s
  // with different `app` do not alias) without plumbing it into the resumed run
  // — deferred to a dedicated follow-up so it is not left accept-but-ignore here.
};

/**
 * Response receipts are fenced to the exact pending generation. This prevents
 * a delayed browser/reconnect response from approving a later interaction
 * that happens to reuse the same item id.
 */
export type InboxResponseOptions = InboxResponsePolicyOptions &
  (
    | {
        responseId?: undefined;
        itemId?: string;
        runId?: never;
        toolCallId?: never;
        pendingRequestedAt?: never;
      }
    | {
        responseId: string;
        itemId: string;
        runId: string;
        toolCallId: string;
        pendingRequestedAt: number;
      }
  );

export interface InboxResponseResult {
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval' | 'sandbox-access';
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
  /** Native identity shared by this queued input and all response segments it owns. */
  logicalMessageIdentity?: LogicalMessageIdentity;

  /** Override the model id for this queued turn. Falls back to session model. */
  model?: string;
  /** Override the active mode for this queued turn. Must be a known mode id. */
  mode?: string;
  /**
   * If `true`, clear the POLICY-level approval reason for this queued turn — an
   * effective `ask` from the §4.2e permission gate, the same reason a session
   * grant clears. It suppresses ONLY that `policy` reason: a tool-owned approval
   * (a tool's static `requireApproval` or its `needsApprovalFn`) still suspends,
   * and a `deny` is still a hard block. Persisted on the queued item so it
   * survives crash replay (and carried across suspend → resume).
   */
  yolo?: boolean;

  /**
   * Caller-supplied request context for this queued turn (§4.4c). Only `app`
   * may be set (see {@link MessageOverrides.requestContext}); other keys are
   * rejected before admission. The normalized `app` bag is persisted on the
   * queued item and rebuilt at drain time, so recovered items use the
   * persisted value — never a fresh caller value.
   */
  requestContext?: RequestContextInput;
}

/** Options accepted by `Session.queue(...)`. */
export interface QueueOptions extends QueueOverrides {
  /** Free-form user content. The only required field. */
  content: string;

  /** Optional idempotency key for retry-safe queue admission. */
  admissionId?: string;

  /** Optional pre-uploaded attachments to include with the user message. */
  attachments?: AttachmentRef[];

  /**
   * Scheduling priority. Higher values drain first. Items with the same
   * priority drain in FIFO order. Defaults to 0.
   */
  priority?: number;

  /**
   * Absolute epoch-ms deadline past which the item must not start. Expired
   * queued items are removed before drain and their receipts are marked failed.
   */
  deadline?: number;

  /**
   * Absolute epoch-ms earliest start time. Items whose `notBefore` is in the
   * future remain queued while eligible lower-priority work can drain.
   */
  notBefore?: number;
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
// `signal()` is the optimistic user-message primitive. Without `admissionId`,
// it resolves with the routing decision (runId + willInterleave) on the first
// await tick. An admitted call first awaits its durable reservation and
// authoritative native acceptance. Neither form awaits run completion; callers
// await `result` for the eventual `AgentResult`.
//
// `injectSystemReminder()` is the system-reminder injection primitive used
// by goal-judge continuations and other harness-internal nudges. System
// reminders don't get their own `agent_start`/`agent_end` — if they drain
// into an active run they're absorbed into that run's events, if they wake
// a new run the new run's lifecycle events cover them.
// ---------------------------------------------------------------------------

/** Options accepted by `Session.signal(...)`. */
export interface SessionSignalOptions {
  /** Native identity for this admitted input; active responses keep their owner. */
  logicalMessageIdentity?: LogicalMessageSignalIdentity;

  /** Free-form user content. Matches `message().content`. */
  content: string;

  /**
   * Optional idempotency key for retry-safe active interleaves and idle wakes.
   * Reusing the key with the same normalized payload returns the original
   * signal/run/result identity; reusing it with a different payload rejects
   * before another signal is dispatched. If the admitted run suspends, its
   * `result` remains pending until the resumed run completes or fails, so a
   * retry observes the same terminal result before and after process restart.
   * The stable run id is an at-least-once execution identity: recovery never
   * invents a second cold run identity for the same admission, but a crash or
   * lost acknowledgement can repeat provider or tool side effects. This key
   * does not make those external effects exactly once.
   */
  admissionId?: string;

  /** Per-turn mode override (same semantics as `message().mode`). */
  mode?: string;

  /**
   * Tools layered on top of the session's effective tool surface for this
   * turn. Mirrors `message().additionalTools` semantics.
   */
  additionalTools?: ToolsInput;

  /**
   * Forwarded to the underlying agent run when the signal wakes a fresh
   * idle run. Ignored on active-delivery (the in-flight run already has
   * its own abort controller).
   */
  abortSignal?: AbortSignal;

  /**
   * Caller-supplied request context for the run this signal wakes (§4.4c).
   * Only `app` may be set (see {@link MessageOverrides.requestContext}); other
   * keys are rejected before admission. Like `abortSignal`, it applies only
   * when the signal wakes a fresh idle run; supplying it on an active-delivery
   * signal is rejected, since it could not reach the in-flight run's tools.
   */
  requestContext?: RequestContextInput;
}

/**
 * Result returned by `Session.signal(...)`. Ordinary calls resolve on the first
 * await tick; admitted calls resolve after durable and native acceptance.
 */
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
}

/** Parameters accepted by `ctx.registerPlanApproval(...)` from a suspending tool. */
export interface RegisterPlanApprovalParams {
  planId: string;
  title?: string;
  plan: string;
}

/** Parameters accepted by `ctx.registerSandboxAccess(...)` from a tool needing sandbox approval. */
export interface RegisterSandboxAccessParams {
  requestId: string;
  semanticType: 'file' | 'command' | 'network' | 'mcp' | 'custom';
  reason?: string;
  payload?: JsonValue;
}

/**
 * §6.1: tool-authored custom event input for `ctx.emitCustomEvent`. The harness
 * validates `type` and fills event/session identity (`id`, `sessionId`,
 * `timestamp`, `runId`) before dispatching the resulting `CustomEvent` (§10.2).
 * `type` must use a dotted custom prefix (e.g. `myorg.tool.progress`) and must
 * not collide with a reserved built-in family.
 */
export interface HarnessCustomEventInput {
  type: string;
  payload?: JsonValue;
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
  /**
   * §6.1: stable harness NAMESPACE (the registered harness name) — identical
   * across processes and sessions for the same logical harness. Use this for
   * durable identity decisions.
   */
  harnessName: string;
  /**
   * §6.1: per-PROCESS harness instance id — useful for log correlation across a
   * single running process. Distinct from {@link harnessName} (the stable namespace).
   */
  harnessInstanceId: string;
  /** The session this tool invocation runs against. Stable for the call's lifetime. */
  sessionId: string;
  /** The thread the session is bound to. Stable for the call's lifetime. */
  threadId: string;
  /** The resource the session is scoped to. Stable for the call's lifetime. */
  resourceId: string;

  /** Resolved mode id for this turn (with any per-turn overrides applied). */
  modeId: string;
  /** Resolved model id for this turn (with any per-turn overrides applied). */
  modelId: string;

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

  /** Turn abort signal. Fires for the four reasons enumerated in §4.5. */
  abortSignal: AbortSignal;

  /** Register a pending question (used by `ask_user` and custom suspending tools). */
  registerQuestion: (params: RegisterQuestionParams) => Promise<void>;
  /** Register a pending plan approval (used by `submit_plan` and custom suspending tools). */
  registerPlanApproval: (params: RegisterPlanApprovalParams) => Promise<void>;
  /** Register a pending sandbox-access approval. */
  registerSandboxAccess?: (params: RegisterSandboxAccessParams) => Promise<void>;
  /**
   * §6.1/§6.3/§10.2: emit a tool-authored custom event to this session's
   * subscribers. The harness validates `type` (dotted custom prefix, not a
   * reserved built-in family) and the payload (JSON-serializable), then stamps
   * event + session identity before dispatch. Throws `HarnessValidationError` at
   * call time on a reserved/invalid type or non-serializable payload.
   */
  emitCustomEvent: (event: HarnessCustomEventInput) => void;
  /**
   * Extend the current session lease before work that may exceed the default
   * lease TTL or block the event loop long enough for the heartbeat to miss.
   */
  extendLease?: (opts: { ttlMs: number }) => Promise<void>;

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
   * one. Tools should null-check before use. Equivalent to `getWorkspace()`.
   */
  workspace?: Workspace;

  /**
   * §6.1 workspace access. `getWorkspace()` and `workspace` are NON-materializing
   * reads (return the cached handle or `undefined`, never a cold start);
   * `resolveWorkspace()` is the explicit async materialize/resume path. A turn
   * whose tools never need the filesystem can avoid cloud-sandbox cold starts by
   * not calling `resolveWorkspace()`. `hasWorkspace()` reports configuration;
   * `isWorkspaceReady()` reports whether a handle is already warm.
   */
  hasWorkspace: () => boolean;
  isWorkspaceReady: () => boolean;
  getWorkspace: () => Workspace | undefined;
  resolveWorkspace: () => Promise<Workspace>;

  /**
   * §6.1 / §5.1b.4 / §5.6 / §10.6 bounded, redacted activity timeline — a
   * READ-TIME projection over this session's durable thread/message log, goal,
   * and pending inbox (plus descendant subagent entries under
   * `includeDescendants`). Never settles promises, proves delivery, claims rows,
   * or mutates state. The lower-durability source kinds (operation-result /
   * durable-work / channel / file-reference) are not emitted yet.
   */
  getActivityTimeline: (opts?: ActivityTimelineOptions) => Promise<SessionActivityTimeline>;

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

// ---------------------------------------------------------------------------
// §5.1b.4 / §5.6 / §10.6 — activity timeline read model.
//
// `SessionActivityTimeline` is a bounded, redacted UX projection assembled at
// READ TIME from existing durable authorities (the thread/message log,
// structured tool_call/tool_result parts, session-owned goal + pending inbox,
// and — under `includeDescendants` — descendant subagent summaries). It is NOT a
// persisted record, durable event stream, or generic activity ledger, never
// settles SDK promises / proves delivery / claims rows / mutates storage, and
// omits raw payloads, request context, token strings, hashes, and unredacted
// errors. Ordering is `(occurredAt ASC, sessionId ASC, entryId ASC)`; the cursor
// is a forward seek over that key plus the addressed session + `includeDescendants`
// scope (a cursor from one scope rejects for the other). See HARNESS_V1_SPEC.md
// §5.1b.4 + the §9 session-snapshot read-time-model rules.
// ---------------------------------------------------------------------------

export interface ActivityTimelineOptions {
  cursor?: string;
  limit?: number;
  /** When true, include descendant subagent entries per the §5.6 / §10.6 ownership rules. */
  includeDescendants?: boolean;
}

export type ActivityTimelineEntryKind =
  | 'message'
  | 'message-tool-call'
  | 'message-tool-result'
  | 'operation-result'
  | 'pending-inbox'
  | 'goal'
  | 'durable-work'
  | 'channel'
  | 'subagent'
  | 'file-reference';

export type ActivityTimelineSourceKind =
  | 'thread-message'
  | 'message-part'
  | 'result-lookup'
  | 'session-snapshot'
  | 'pending-inbox'
  | 'subagent-session'
  | 'durable-work-summary'
  | 'channel-diagnostics'
  | 'workspace-projection'
  | 'application-datastore';

export interface ActivityTimelineSourceRef {
  kind: ActivityTimelineSourceKind;
  id: string;
  route?: 'thread-messages' | 'signal-result' | 'queue-result' | 'subagent-inbox' | 'channel-diagnostics';
}

export interface ActivityTimelineActor {
  kind: 'user' | 'assistant' | 'system' | 'tool' | 'channel' | 'goal' | 'subagent' | 'harness';
  label?: string;
  channelId?: string;
  providerId?: string;
}

export interface ActivityTimelineEntry {
  /**
   * Deterministic, source-derived id (e.g. `message:<sessionId>:<messageId>` or
   * `message-tool-call:<sessionId>:<messageId>:<partIndex>`). Stable for UI
   * de-dupe while the source evidence exists; NOT an SSE id or read cursor.
   */
  entryId: string;
  kind: ActivityTimelineEntryKind;
  sessionId: string;
  threadId: string;
  occurredAt: number;
  updatedAt?: number;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
  toolCallId?: string;
  subagentSessionId?: string;
  parentSessionId?: string;
  parentEntryId?: string;
  depth?: number;
  actor?: ActivityTimelineActor;
  sourceDurability: 'durable' | 'retention-bound' | 'best-effort' | 'live-only';
  sourceRefs: ActivityTimelineSourceRef[];
  title: string;
  summary?: string;
  /** Redacted, display-oriented JSON only — never raw payloads/args/results. */
  payload?: JsonValue;
}

export interface SessionActivityTimeline {
  sessionId: string;
  threadId: string;
  generatedAt: number;
  includeDescendants: boolean;
  entries: ActivityTimelineEntry[];
  nextCursor?: string;
  truncated: boolean;
}
