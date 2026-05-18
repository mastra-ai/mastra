import type { ToolAction } from '../tools/types';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ConnectionField,
  ListConnectionsOpts,
  ListConnectionsResult,
  ListToolServicesResult,
  ListToolsOpts,
  ListToolsResult,
  ResolveToolsOpts,
  ToolDescriptor,
  ToolIntegration,
  ToolIntegrationCapabilities,
  ToolIntegrationHealth,
  ToolService,
} from './tool-integration';

/**
 * Constructor options shared by every {@link BaseToolIntegration} subclass.
 *
 * Allowlists are matched against the **provider-opaque slugs** returned by
 * `listAllToolServices()` / `listAllTools()`. Two forms are supported:
 *
 * - exact slug match: `'gmail'`
 * - suffix wildcard:  `'gmail.*'` (matches `gmail.fetch_emails`, `gmail.send`, ...)
 *
 * Full glob support (e.g. `'*.fetch_*'`) is out of scope for v1 and can land in v1.5.
 *
 * `allowedTools` is keyed by tool-service slug. If a service is listed in
 * `allowedToolServices` but **not** present in `allowedTools`, all of its
 * tools are included (no per-tool filtering). An explicit empty array
 * (`allowedTools: { gmail: [] }`) filters everything out for that service.
 */
export interface BaseToolIntegrationOptions {
  /** When set, `listToolServices()` keeps only services whose slug matches. */
  allowedToolServices?: readonly string[];
  /**
   * Per-service tool allowlist. Keys are tool-service slugs; values are
   * patterns matched against tool slugs (exact or `prefix*`). Omitting a
   * service leaves its tools unfiltered.
   */
  allowedTools?: Readonly<Record<string, readonly string[]>>;
}

/**
 * Shared base class for concrete {@link ToolIntegration} implementations.
 *
 * Subclasses implement the SDK-specific `listAllToolServices` and
 * `listAllTools` methods (and the runtime / auth methods); the base class
 * layers admin allowlist filtering on top so every adapter behaves the
 * same way.
 *
 * Server-side pagination / search support is the **adapter's**
 * responsibility — the base class forwards `ListToolsOpts` verbatim and
 * only filters the resulting slugs against the admin allowlist.
 */
export abstract class BaseToolIntegration implements ToolIntegration {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: ToolIntegrationCapabilities;

  protected readonly allowedToolServices: readonly string[];
  protected readonly allowedTools: Readonly<Record<string, readonly string[]>>;

  constructor(options: BaseToolIntegrationOptions = {}) {
    this.allowedToolServices = options.allowedToolServices ?? [];
    this.allowedTools = options.allowedTools ?? {};
  }

  // ── catalog (filtered) ────────────────────────────────────────────────

  async listToolServices(): Promise<ListToolServicesResult> {
    const all = await this.listAllToolServices();
    const data =
      this.allowedToolServices.length === 0
        ? all
        : all.filter(service => matchesAny(service.slug, this.allowedToolServices));
    return { data };
  }

  async listTools(opts: ListToolsOpts = {}): Promise<ListToolsResult> {
    // Deny tool services that aren't in the allowlist before touching the SDK.
    if (
      opts.toolService !== undefined &&
      this.allowedToolServices.length > 0 &&
      !matchesAny(opts.toolService, this.allowedToolServices)
    ) {
      return {
        data: [],
        pagination: { page: opts.page ?? 1, perPage: opts.perPage, hasMore: false },
      };
    }
    const result = await this.listAllTools(opts);
    // Per-service allowlist: only filter tools whose service has an entry in
    // `allowedTools`. Services without an entry pass through unfiltered.
    if (Object.keys(this.allowedTools).length === 0) return result;
    return {
      ...result,
      data: result.data.filter(tool => {
        const patterns = this.allowedTools[tool.toolService];
        if (patterns === undefined) return true;
        return matchesAny(tool.slug, patterns);
      }),
    };
  }

  // ── SDK hooks subclasses implement ────────────────────────────────────

  protected abstract listAllToolServices(): Promise<ToolService[]>;
  protected abstract listAllTools(opts: ListToolsOpts): Promise<ListToolsResult>;

  abstract resolveTools(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>>;

  abstract authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;
  abstract getAuthStatus(authId: string): Promise<AuthFlowStatus>;
  abstract getConnectionStatus(opts: {
    items: Array<{ connectionId: string; toolService: string }>;
  }): Promise<Record<string, { connected: boolean }>>;
  abstract listConnections(opts: ListConnectionsOpts): Promise<ListConnectionsResult>;

  /**
   * Default connection-fields implementation — returns `[]`. Subclasses
   * whose underlying provider requires user-supplied custom fields at
   * authorize time (e.g. Confluence subdomain) should override.
   */

  async listConnectionFields(_opts: { toolService: string }): Promise<ConnectionField[]> {
    return [];
  }

  /**
   * Default health implementation — returns `{ ok: true }`. Subclasses that
   * need to probe SDK reachability or configuration should override.
   */
  async getHealth(): Promise<ToolIntegrationHealth> {
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

// Keep ToolDescriptor reachable for callers that import via this module path.
export type { ToolDescriptor };
