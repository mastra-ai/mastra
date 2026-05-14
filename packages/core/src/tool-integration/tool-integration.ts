import type { ToolAction } from '../tools/types';

/**
 * Agent Builder Tool Integrations — canonical, provider-agnostic surface.
 *
 * Shipped alongside the legacy `ToolProvider*` interface in
 * `../tool-provider/types.ts`. The legacy interface is a deprecated alias
 * and will be removed in a future major release.
 */

/**
 * A bundle of tools that share an OAuth boundary (e.g. Gmail, Slack).
 *
 * Composio calls this a "toolkit"; the neutral term keeps additional
 * integrations (e.g. Arcade) from having to adopt vendor vocabulary.
 */
export interface ToolService {
  /** Provider-opaque slug (e.g. `'gmail'`). */
  slug: string;
  /** Human-readable name. */
  name: string;
  description?: string;
  /** Provider-supplied icon URL or identifier. */
  icon?: string;
}

/**
 * Listing entry for a single callable tool within a {@link ToolService}.
 *
 * Used for UI discovery — does **not** include an executable tool body.
 */
export interface ToolDescriptor {
  /** Fully-qualified tool slug, e.g. `'gmail.fetch_emails'`. */
  slug: string;
  /** Human-readable name. */
  name: string;
  description?: string;
  /** Slug of the parent {@link ToolService}. */
  toolService: string;
}

/**
 * Per-integration capability flags. Lets callers branch on optional features
 * without instanceof / subclass checks.
 */
export interface ToolIntegrationCapabilities {
  /** Integration supports multiple connections (OAuth buckets) on the same tool service. */
  multipleConnectionsPerService: boolean;
  /** Integration can answer `getConnectionStatus` for many items in one call. */
  batchConnectionStatus: boolean;
  /** Re-authorizing a connection reuses the same `connectionId` (token refresh in place). */
  reauthorizeReusesConnectionId: boolean;
}

/**
 * A single OAuth bucket bound to one {@link ToolService} on one agent.
 *
 * Stored verbatim in `StorageStoredAgent.toolIntegrations[integrationId].connections[toolService]`.
 */
export interface Connection {
  /**
   * Identity binding kind.
   *
   * - `'author'` — uses the agent author's connection (v1 default).
   * - `'invoker'` — uses the end-user's connection (v1.5, schema-reserved).
   * - `'platform'` — uses a shared platform account (v2, schema-reserved).
   */
  kind: 'author' | 'invoker' | 'platform';
  /** Parent tool service slug. Denormalized for callsite clarity. */
  toolService: string;
  /**
   * Provider-opaque identifier for the OAuth bucket.
   *
   * Required for `'author'` and `'platform'`; reserved (empty) for `'invoker'`.
   */
  connectionId: string;
  /**
   * Display label and LLM disambiguator. Required, non-empty, ≤ 32 chars,
   * `[A-Za-z0-9 _-]+`. Case-insensitive uniqueness is enforced within
   * `connections[toolService]`.
   */
  label: string;
}

/**
 * Per-tool override stored alongside the selected tool slug.
 */
export interface ToolMeta {
  /** Optional description override surfaced to the LLM. */
  description?: string;
}

/**
 * Stored shape for one integration's configuration on one agent.
 */
export interface ToolIntegrationConfig {
  /** Selected tool slugs and their per-agent overrides. Key = tool slug. */
  tools: Record<string, ToolMeta>;
  /** Connections grouped by tool service slug. */
  connections: Record<string, Connection[]>;
}

/**
 * The full tool-integrations shape on an agent: keyed by integration id.
 */
export type ToolIntegrations = Record<string /* integrationId */, ToolIntegrationConfig>;

/**
 * Options for `ToolIntegration.resolveTools`.
 *
 * The runtime fan-out (`resolveStoredToolIntegrations`) calls this
 * **once per connection** — integrations never see fan-out logic or
 * tool-name suffixes.
 */
export interface ResolveToolsOpts {
  /** Original tool slugs to materialise. */
  toolSlugs: string[];
  /** Per-tool overrides (description, etc.) keyed by tool slug. */
  toolMeta: Record<string, ToolMeta>;
  /** Provider-opaque OAuth bucket identifier. */
  connectionId: string;
  /** Per-request context (auth, tenant, currentUser, ...). */
  requestContext?: Record<string, unknown>;
}

/**
 * Options for `ToolIntegration.authorize`.
 */
export interface AuthorizeOpts {
  /** Tool service slug being authorized. */
  toolService: string;
  /**
   * Existing or newly-minted connection bucket id.
   *
   * Integrations with `reauthorizeReusesConnectionId: true` refresh the
   * token in place when a known id is supplied.
   */
  connectionId: string;
  /** Optional tool slug — some integrations scope authorize per tool. */
  toolName?: string;
}

/**
 * Health summary returned by `ToolIntegration.getHealth`.
 */
export interface ToolIntegrationHealth {
  ok: boolean;
  /** Short, user-facing message. */
  message?: string;
  /** Free-form per-integration diagnostics. */
  details?: Record<string, unknown>;
}

/**
 * Async OAuth flow status as observed by `getAuthStatus`.
 */
export type AuthFlowStatus = 'pending' | 'completed' | 'failed';

/**
 * Provider-agnostic tool integration interface.
 *
 * Implementations live in `@mastra/editor`. Core only depends on the
 * contract.
 */
export interface ToolIntegration {
  /** Stable opaque id, e.g. `'composio'`. Used as the registry key. */
  readonly id: string;
  /** Human-readable integration name. */
  readonly displayName: string;
  /** Static capability flags. */
  readonly capabilities: ToolIntegrationCapabilities;

  /** List allowed tool services (after admin allowlist). */
  listToolServices(): Promise<ToolService[]>;

  /** List allowed tools for one tool service. */
  listTools(toolService: string): Promise<ToolDescriptor[]>;

  /**
   * Materialise executable Mastra tools for one (toolSlugs × connection)
   * call. Runtime fan-out invokes this once per connection and applies
   * naming/suffix logic on top.
   */
  resolveTools(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>>;

  /** Start an OAuth flow; returns the redirect URL and an opaque auth handle. */
  authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;

  /** Poll the OAuth flow status by `authId`. */
  getAuthStatus(authId: string): Promise<AuthFlowStatus>;

  /**
   * Batch-check whether a set of `(connectionId, toolService)` tuples
   * are still connected (lazy revocation detection).
   *
   * The return record is keyed by `connectionId`.
   */
  getConnectionStatus(opts: {
    items: Array<{ connectionId: string; toolService: string }>;
  }): Promise<Record<string, { connected: boolean }>>;

  /** Integration-level health (config, reachability, etc.). */
  getHealth(): Promise<ToolIntegrationHealth>;
}
