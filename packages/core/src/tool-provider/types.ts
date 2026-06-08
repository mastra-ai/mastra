import type { StorageToolConfig } from '../storage/types';
import type { ToolAction } from '../tools/types';

/**
 * Metadata about a tool provider.
 */
export interface ToolProviderInfo {
  /** Unique identifier for this provider (e.g., 'composio') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of the provider */
  description?: string;
}

/**
 * A toolkit (group of related tools) from a tool provider.
 *
 * Composio calls this a "toolkit"; the neutral term keeps additional
 * providers (e.g. Arcade) from having to adopt vendor vocabulary.
 */
export interface ToolProviderToolkit {
  /** Unique slug for this toolkit (e.g., 'gmail', 'slack') */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of the toolkit */
  description?: string;
  /** Icon URL or identifier */
  icon?: string;
}

/**
 * A tool listing entry from a tool provider.
 * Used for UI discovery — does not include the full executable tool.
 */
export interface ToolProviderToolInfo {
  /** Fully-qualified tool slug (e.g., 'gmail.fetch_emails') */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of what this tool does */
  description?: string;
  /** Toolkit (tool service) this tool belongs to */
  toolkit?: string;
}

/**
 * Options for listing tools from a provider.
 */
export interface ListToolProviderToolsOptions {
  /** Filter by toolkit slug */
  toolkit?: string;
  /** Search query for filtering tools */
  search?: string;
  /** Pagination cursor or page (1-indexed) */
  page?: number;
  /** Number of tools per page */
  perPage?: number;
}

/**
 * Paginated result from tool provider list operations.
 */
export interface ToolProviderListResult<T> {
  data: T[];
  pagination?: {
    total?: number;
    page?: number;
    perPage?: number;
    hasMore: boolean;
  };
}

/**
 * Options for resolving executable tools at agent runtime.
 */
export interface ResolveToolProviderToolsOptions {
  /** User ID for user-scoped tool execution (e.g., Composio) */
  userId?: string;
  /** Per-request context (e.g., user-specific API keys, tenant IDs) */
  requestContext?: Record<string, unknown>;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

// ── Capabilities ────────────────────────────────────────────────────────

/**
 * Per-provider capability flags. Lets callers branch on optional features
 * without instanceof / subclass checks.
 */
export interface ToolProviderCapabilities {
  /** Provider supports multiple connections (OAuth buckets) on the same toolkit. */
  multipleConnectionsPerToolkit: boolean;
  /** Provider can answer `getConnectionStatus` for many items in one call. */
  batchConnectionStatus: boolean;
  /** Re-authorizing a connection reuses the same `connectionId` (token refresh in place). */
  reauthorizeReusesConnectionId: boolean;
  /**
   * Provider supports revoking a connection at the underlying service (true) vs.
   * only unpinning it locally (false). UI hides the "Disconnect" affordance
   * when this is falsy.
   */
  supportsRevoke?: boolean;
}

// ── Connections + scope ─────────────────────────────────────────────────

/**
 * Identity bucketing for a pinned connection.
 *
 * - `'per-author'` (default) — bucketed under the caller's resolved authorId.
 * - `'shared'` — bucketed under {@link SHARED_BUCKET_ID}, visible to every caller.
 * - `'caller-supplied'` — bucketed under the host app's `resourceId` forwarded
 *   via request context. Used for multi-tenant SaaS deployments where the
 *   host app authenticates the end-user upstream. Falls back to a shared
 *   `'default'` bucket when the resource id is missing; multi-tenant
 *   deployments should wire the resource id explicitly (e.g. via
 *   `authConfig.mapUserToResourceId`) to avoid cross-tenant bucket sharing.
 */
export type ToolProviderConnectionScope = 'shared' | 'per-author' | 'caller-supplied';

/**
 * Constant authorId used to bucket {@link ToolProviderConnection}s with
 * `scope: 'shared'`.
 */
export const SHARED_BUCKET_ID = 'shared';

/**
 * A single OAuth bucket bound to one toolkit on one agent.
 */
export interface ToolProviderConnection {
  /**
   * Identity binding kind.
   *
   * - `'author'` — uses the agent author's connection (v1 default).
   * - `'invoker'` — uses the end-user's connection (reserved).
   * - `'platform'` — uses a shared platform account (reserved).
   */
  kind: 'author' | 'invoker' | 'platform';
  /** Parent toolkit slug. Denormalized for callsite clarity. */
  toolkit: string;
  /**
   * Provider-opaque identifier for the OAuth bucket.
   *
   * Required for `'author'` and `'platform'`; reserved (empty) for `'invoker'`.
   */
  connectionId: string;
  /**
   * Display label and LLM disambiguator. Optional when this is the only
   * connection for a `toolkit`; required (non-empty, ≤ 32 chars,
   * `[A-Za-z0-9 _-]+`, case-insensitively unique) once there are ≥ 2
   * connections sharing the same `toolkit`.
   */
  label?: string;
  /**
   * Identity bucketing. Optional for back-compat with pre-scope pins;
   * treated as `'per-author'` when missing.
   */
  scope?: ToolProviderConnectionScope;
}

/**
 * Per-tool override stored alongside the selected tool slug.
 */
export interface ToolProviderToolMeta {
  /**
   * Toolkit this slug belongs to. Required for the runtime to group
   * selected tools by toolkit when fanning out across connections.
   * Optional only for backward-compat with pre-fix stored data; new writes
   * must include it.
   */
  toolkit?: string;
  /** Optional description override surfaced to the LLM. */
  description?: string;
}

/**
 * Stored shape for one provider's configuration on one agent.
 */
export interface ToolProviderConfig {
  /** Selected tool slugs and their per-agent overrides. Key = tool slug. */
  tools: Record<string, ToolProviderToolMeta>;
  /** Connections grouped by toolkit slug. */
  connections: Record<string, ToolProviderConnection[]>;
}

/**
 * The full tool-providers shape on an agent: keyed by provider id.
 */
export type ToolProviders = Record<string /* providerId */, ToolProviderConfig>;

// ── List / auth / health surface ─────────────────────────────────────────

/**
 * Options for `ToolProvider.listToolsVNext`. All fields are optional.
 */
export interface ListToolsOpts {
  /** Restrict results to one toolkit slug. */
  toolkit?: string;
  /** Free-text search across tool slugs / names / descriptions. */
  search?: string;
  /** 1-indexed page number for paginated listings. */
  page?: number;
  /** Page size. Adapters may clamp to a sane upper bound. */
  perPage?: number;
}

/**
 * Wrapped pagination envelope returned by `listToolsVNext`. `hasMore` is the
 * only forward-progress signal — adapters are not required to surface a
 * total count.
 */
export interface ListToolsResult {
  data: ToolProviderToolInfo[];
  pagination: {
    page: number;
    perPage?: number;
    hasMore: boolean;
  };
}

/** Wrapped result returned by `listToolkitsVNext`. */
export interface ListToolkitsResult {
  data: ToolProviderToolkit[];
}

/**
 * Options for `ToolProvider.resolveToolsVNext`.
 *
 * The runtime fan-out calls this **once per connection** — providers never
 * see fan-out logic or tool-name suffixes.
 */
export interface ResolveToolsOpts {
  /** Original tool slugs to materialise. */
  toolSlugs: string[];
  /** Per-tool overrides (description, etc.) keyed by tool slug. */
  toolMeta: Record<string, ToolProviderToolMeta>;
  /** Provider-opaque OAuth bucket identifier. */
  connectionId: string;
  /**
   * For `kind: 'author'` connections, the agent author's user id. The runtime
   * uses this as the provider's user bucket so the pin works for any
   * invoker, not just the author. Falsy = fall back to request context.
   */
  authorId?: string;
  /** Per-request context (auth, tenant, currentUser, ...). */
  requestContext?: Record<string, unknown>;
}

/**
 * Options for `ToolProvider.authorize`.
 */
export interface AuthorizeOpts {
  /** Toolkit slug being authorized. */
  toolkit: string;
  /**
   * Existing or newly-minted connection bucket id.
   *
   * Providers with `reauthorizeReusesConnectionId: true` refresh the token
   * in place when a known id is supplied.
   */
  connectionId: string;
  /** Optional tool slug — some providers scope authorize per tool. */
  toolName?: string;
  /**
   * Provider-specific custom fields collected from the user before the
   * OAuth flow starts (e.g. Confluence `{ subdomain: 'mycorp' }`).
   */
  config?: Record<string, unknown>;
}

/**
 * A single user-supplied field required to open a new connection on a
 * toolkit. Surfaced by {@link ToolProvider.listConnectionFields} and
 * rendered inline in the connection picker.
 */
export interface ConnectionField {
  /** Programmatic name (e.g. `'subdomain'`). Sent back as a key in `AuthorizeOpts.config`. */
  name: string;
  /** Human-readable label (e.g. `'Your Subdomain'`). */
  displayName: string;
  /** Optional helper text rendered under the input. */
  description?: string;
  /** Storage / input type. Adapters coerce richer types into one of these. */
  type: 'string' | 'number' | 'boolean';
  /** Whether the user must provide a value before authorize can run. */
  required: boolean;
  /** Provider-suggested default (rendered as the input's initial value). */
  default?: string | null;
}

/**
 * Health summary returned by `ToolProvider.getHealth`.
 */
export interface ToolProviderHealth {
  ok: boolean;
  /** Short, user-facing message. */
  message?: string;
  /** Free-form per-provider diagnostics. */
  details?: Record<string, unknown>;
}

/**
 * Async OAuth flow status as observed by `getAuthStatus`.
 */
export type AuthFlowStatus = 'pending' | 'completed' | 'failed';

/**
 * Options for `ToolProvider.listConnections`.
 *
 * Use `userIds[]` to list across multiple buckets in one call (admin
 * cross-author listing). `userId` is the single-bucket convenience and is
 * normalized to `[userId]` internally.
 */
export interface ListConnectionsOpts {
  /** Toolkit slug. */
  toolkit: string;
  /** Multi-bucket lookup. Preferred when present. */
  userIds?: string[];
  /** Single-bucket convenience. */
  userId?: string;
  /** 1-indexed page number for paginated listings. */
  page?: number;
  /** Page size. Adapters clamp to a sane upper bound (default 50, max 200). */
  perPage?: number;
}

/** One existing connection on the underlying provider. */
export interface ExistingConnection {
  /** Provider-issued connection identifier (e.g. Composio `ca_xxx`). */
  connectionId: string;
  /** Connection state: `'active'` is safe to pin. */
  status: 'active' | 'inactive' | 'failed' | 'pending';
  /** When the connection was created, if the provider reports it. */
  createdAt?: string;
  /**
   * Bucket owner this connection belongs to. Mirrors the `userId` /
   * `authorId` the connection was created under. Surfaced for admin
   * cross-author UI.
   */
  authorId?: string;
}

export interface ListConnectionsResult {
  items: ExistingConnection[];
  /** Pagination envelope. Adapters are not required to surface a total count. */
  pagination: {
    page: number;
    perPage?: number;
    hasMore: boolean;
    total?: number;
  };
}

/**
 * Interface for tool providers (e.g., Composio) that supply tools to agents.
 *
 * Tool providers serve two purposes:
 * 1. **Discovery** — UI uses `listToolkits()` / `listToolkitsVNext()` / `listTools()` / `listToolsVNext()` to browse available tools
 * 2. **Runtime** — Agent hydration uses `resolveTools()` / `resolveToolsVNext()` to get executable tools for selected tool slugs
 *
 * The VNext surface (`listToolkitsVNext` / `listToolsVNext` / `resolveToolsVNext` and the
 * auth/health methods below) is opt-in: providers can keep using the legacy
 * `listTools()` / `resolveTools()` pair for static, code-config use cases.
 */
export interface ToolProvider {
  /** Provider metadata */
  readonly info: ToolProviderInfo;

  /**
   * Optional human-readable display name surfaced in the picker. Falls back
   * to `info.name` when absent.
   */
  readonly displayName?: string;

  /**
   * Static capability flags. Required when the v2 surface is implemented;
   * legacy providers may omit it.
   */
  readonly capabilities?: ToolProviderCapabilities;

  // ── Legacy surface (kept for back-compat) ─────────────────────────────

  /**
   * List available toolkits from this provider.
   * Used by UI for browsing.
   */
  listToolkits?(): Promise<ToolProviderListResult<ToolProviderToolkit>>;

  /**
   * List available tools, optionally filtered by toolkit or search query.
   * Used by UI for browsing/selecting tools.
   */
  listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>>;

  /**
   * Get the JSON schema for a specific tool's input.
   * Used by UI to display tool details.
   */
  getToolSchema?(toolSlug: string): Promise<Record<string, unknown> | null>;

  /**
   * Resolve executable tools for the given slugs (legacy signature).
   * Called during agent hydration to resolve `integrationTools` references.
   */
  resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<any, any, any>>>;

  // ── VNext surface (opt-in, used by Agent Builder + editor UI) ────────

  /** List allowed toolkits, wrapped in a result envelope. */
  listToolkitsVNext?(): Promise<ListToolkitsResult>;

  /**
   * List allowed tools (wrapped envelope). With no options, lists across
   * every toolkit. Pass `toolkit` to scope; pass `search` to filter; pass
   * `page` / `perPage` to paginate.
   */
  listToolsVNext?(opts?: ListToolsOpts): Promise<ListToolsResult>;

  /**
   * Materialise executable Mastra tools for one (toolSlugs × connection)
   * call. Runtime fan-out invokes this once per connection and applies
   * naming/suffix logic on top.
   */
  resolveToolsVNext?(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>>;

  /** Start an OAuth flow; returns the redirect URL and an opaque auth handle. */
  authorize?(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;

  /**
   * List provider-specific custom fields the user must supply when starting
   * a fresh OAuth flow for `toolkit` (e.g. Confluence subdomain).
   *
   * Returning `[]` means the provider can authorize without extra input.
   * The picker UI shows an inline form when this is non-empty.
   */
  listConnectionFields?(opts: { toolkit: string }): Promise<ConnectionField[]>;

  /** Poll the OAuth flow status by `authId`. */
  getAuthStatus?(authId: string): Promise<AuthFlowStatus>;

  /**
   * Batch-check whether a set of `(connectionId, toolkit)` tuples are still
   * connected (lazy revocation detection). Result keyed by `connectionId`.
   */
  getConnectionStatus?(opts: {
    items: Array<{ connectionId: string; toolkit: string }>;
  }): Promise<Record<string, { connected: boolean }>>;

  /**
   * List the underlying provider's existing connections for a given user +
   * toolkit. Used by the picker UI to surface already-authorized accounts
   * so authors can pin them onto an agent without re-running OAuth.
   */
  listConnections?(opts: ListConnectionsOpts): Promise<ListConnectionsResult>;

  /** Provider-level health (config, reachability, etc.). */
  getHealth?(): Promise<ToolProviderHealth>;

  /**
   * Revoke an existing connection at the provider. Only meaningful when
   * `capabilities.supportsRevoke` is true. Implementations should treat a
   * missing connection (already revoked / never existed) as a success.
   */
  revokeConnection?(connectionId: string): Promise<void>;
}
