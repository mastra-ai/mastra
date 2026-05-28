import type { StorageToolConfig } from '../storage/types';
import type { ToolAction } from '../tools/types';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ConnectionField,
  ListConnectionsOpts,
  ListConnectionsResult,
  ListToolkitsResult,
  ListToolsOpts,
  ListToolsResult,
  ResolveToolsOpts,
  ToolProvider,
  ToolProviderCapabilities,
  ToolProviderHealth,
  ToolProviderInfo,
  ToolProviderListResult,
  ToolProviderToolInfo,
  ToolProviderToolkit,
} from './types';

/**
 * Constructor options shared by every {@link BaseToolProvider} subclass.
 *
 * Allowlists are matched against the **provider-opaque slugs** returned by
 * `listAllToolkits()` / `listAllTools()`. Two forms are supported:
 *
 * - exact slug match: `'gmail'`
 * - suffix wildcard:  `'gmail.*'`
 *
 * `allowedTools` is keyed by toolkit slug. If a toolkit is listed in
 * `allowedToolkits` but **not** present in `allowedTools`, all of its
 * tools are included. An explicit empty array (`allowedTools: { gmail: [] }`)
 * filters everything out for that toolkit.
 */
export interface BaseToolProviderOptions {
  /** When set, `listToolkitsVNext()` keeps only toolkits whose slug matches. */
  allowedToolkits?: readonly string[];
  /**
   * Per-toolkit tool allowlist. Keys are toolkit slugs; values are patterns
   * matched against tool slugs (exact or `prefix*`). Omitting a toolkit
   * leaves its tools unfiltered.
   */
  allowedTools?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Shared base class for concrete {@link ToolProvider} implementations.
 *
 * Subclasses implement the SDK-specific `listAllToolkits` and
 * `listAllTools` methods (and the runtime / auth methods); the base class
 * layers admin allowlist filtering on top so every adapter behaves the
 * same way.
 */
export abstract class BaseToolProvider implements ToolProvider {
  abstract readonly info: ToolProviderInfo;
  abstract readonly capabilities: ToolProviderCapabilities;

  protected readonly allowedToolkits: readonly string[];
  protected readonly allowedTools: Readonly<Record<string, readonly string[]>>;

  constructor(options: BaseToolProviderOptions = {}) {
    this.allowedToolkits = options.allowedToolkits ?? [];
    this.allowedTools = options.allowedTools ?? {};
  }

  // ── VNext catalog (filtered) ──────────────────────────────────────────

  async listToolkitsVNext(): Promise<ListToolkitsResult> {
    const all = await this.listAllToolkits();
    const data =
      this.allowedToolkits.length === 0 ? all : all.filter(toolkit => matchesAny(toolkit.slug, this.allowedToolkits));
    return { data };
  }

  async listToolsVNext(opts: ListToolsOpts = {}): Promise<ListToolsResult> {
    // Deny toolkits not in the allowlist before touching the SDK.
    if (
      opts.toolkit !== undefined &&
      this.allowedToolkits.length > 0 &&
      !matchesAny(opts.toolkit, this.allowedToolkits)
    ) {
      return {
        data: [],
        pagination: { page: opts.page ?? 1, perPage: opts.perPage, hasMore: false },
      };
    }
    const result = await this.listAllTools(opts);
    if (Object.keys(this.allowedTools).length === 0) return result;
    return {
      ...result,
      data: result.data.filter(tool => {
        const toolkit = tool.toolkit;
        if (!toolkit) return true;
        const patterns = this.allowedTools[toolkit];
        if (patterns === undefined) return true;
        return matchesAny(tool.slug, patterns);
      }),
    };
  }

  // ── legacy surface (default forwards to VNext) ───────────────────────

  async listToolkits(): Promise<ToolProviderListResult<ToolProviderToolkit>> {
    const result = await this.listToolkitsVNext();
    return { data: result.data };
  }

  async listTools(options: ListToolsOpts = {}): Promise<ToolProviderListResult<ToolProviderToolInfo>> {
    const result = await this.listToolsVNext(options);
    return { data: result.data, pagination: result.pagination };
  }

  /**
   * Legacy `resolveTools` shim — subclasses that opt into the VNext surface
   * normally implement `resolveToolsVNext` instead; the legacy signature
   * delegates so existing callers keep working.
   */
  async resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: { userId?: string; requestContext?: Record<string, unknown>; [key: string]: unknown },
  ): Promise<Record<string, ToolAction<any, any, any>>> {
    return this.resolveToolsVNext({
      toolSlugs,
      toolMeta: Object.fromEntries(
        Object.entries(toolConfigs ?? {}).map(([slug, cfg]) => [slug, { description: cfg?.description }]),
      ),
      connectionId: '',
      authorId: options?.userId,
      requestContext: options?.requestContext,
    });
  }

  // ── SDK hooks subclasses implement ────────────────────────────────────

  protected abstract listAllToolkits(): Promise<ToolProviderToolkit[]>;
  protected abstract listAllTools(opts: ListToolsOpts): Promise<ListToolsResult>;

  abstract resolveToolsVNext(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>>;

  abstract authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;
  abstract getAuthStatus(authId: string): Promise<AuthFlowStatus>;
  abstract getConnectionStatus(opts: {
    items: Array<{ connectionId: string; toolkit: string }>;
  }): Promise<Record<string, { connected: boolean }>>;
  abstract listConnections(opts: ListConnectionsOpts): Promise<ListConnectionsResult>;

  /**
   * Default connection-fields implementation — returns `[]`. Subclasses
   * whose underlying provider requires user-supplied custom fields at
   * authorize time (e.g. Confluence subdomain) should override.
   */
  async listConnectionFields(_opts: { toolkit: string }): Promise<ConnectionField[]> {
    return [];
  }

  /**
   * Default health implementation — returns `{ ok: true }`. Subclasses that
   * need to probe SDK reachability or configuration should override.
   */
  async getHealth(): Promise<ToolProviderHealth> {
    return { ok: true };
  }
}

/**
 * Matches `slug` against an allowlist entry. Supports exact match and a
 * `prefix*` suffix wildcard.
 */
function matchesAny(slug: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === slug) return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (slug.startsWith(prefix)) return true;
    }
  }
  return false;
}
