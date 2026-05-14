import type { ToolAction } from '../tools/types';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
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
 * `fetchToolServices()` / `fetchTools()`. Two forms are supported:
 *
 * - exact slug match: `'gmail'`
 * - suffix wildcard:  `'gmail.*'` (matches `gmail.fetch_emails`, `gmail.send`, ...)
 *
 * Full glob support (e.g. `'*.fetch_*'`) is out of scope for v1 and can land in v1.5.
 */
export interface BaseToolIntegrationOptions {
  /** When set, `listToolServices()` keeps only services whose slug matches. */
  allowedToolServices?: readonly string[];
  /** When set, `listTools()` keeps only tools whose slug matches. */
  allowedTools?: readonly string[];
}

/**
 * Shared base class for concrete {@link ToolIntegration} implementations.
 *
 * Subclasses implement the SDK-specific `fetchToolServices` and `fetchTools`
 * methods (and the runtime / auth methods); the base class layers admin
 * allowlist filtering on top so every adapter behaves the same way.
 */
export abstract class BaseToolIntegration implements ToolIntegration {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly capabilities: ToolIntegrationCapabilities;

  protected readonly allowedToolServices: readonly string[];
  protected readonly allowedTools: readonly string[];

  constructor(options: BaseToolIntegrationOptions = {}) {
    this.allowedToolServices = options.allowedToolServices ?? [];
    this.allowedTools = options.allowedTools ?? [];
  }

  // ── catalog (filtered) ────────────────────────────────────────────────

  async listToolServices(): Promise<ToolService[]> {
    const all = await this.fetchToolServices();
    if (this.allowedToolServices.length === 0) return all;
    return all.filter(service => matchesAny(service.slug, this.allowedToolServices));
  }

  async listTools(toolService: string): Promise<ToolDescriptor[]> {
    // Deny tool services that aren't in the allowlist before touching the SDK.
    if (this.allowedToolServices.length > 0 && !matchesAny(toolService, this.allowedToolServices)) {
      return [];
    }
    const all = await this.fetchTools(toolService);
    if (this.allowedTools.length === 0) return all;
    return all.filter(tool => matchesAny(tool.slug, this.allowedTools));
  }

  // ── SDK hooks subclasses implement ────────────────────────────────────

  protected abstract fetchToolServices(): Promise<ToolService[]>;
  protected abstract fetchTools(toolService: string): Promise<ToolDescriptor[]>;

  abstract resolveTools(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>>;

  abstract authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }>;
  abstract getAuthStatus(authId: string): Promise<AuthFlowStatus>;
  abstract getConnectionStatus(opts: {
    items: Array<{ connectionId: string; toolService: string }>;
  }): Promise<Record<string, { connected: boolean }>>;

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
