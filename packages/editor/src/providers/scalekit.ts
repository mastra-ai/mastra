import type {
  ToolProvider,
  ToolProviderInfo,
  ToolProviderToolkit,
  ToolProviderToolInfo,
  ToolProviderListResult,
  ListToolProviderToolsOptions,
  ResolveToolProviderToolsOptions,
} from '@mastra/core/tool-provider';
import type { ToolAction } from '@mastra/core/tools';
import type { StorageToolConfig } from '@mastra/core/storage';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { convertSchemaToZod } from '@mastra/schema-compat';

export interface ScalekitToolProviderConfig {
  /** Scalekit environment URL (e.g. https://acme.scalekit.dev) */
  envURL: string;
  /** Scalekit client ID */
  clientId: string;
  /** Scalekit client secret */
  clientSecret: string;
}

/** Raw tool object from the Scalekit API. */
interface ScalekitRawTool {
  id: string;
  provider: string;
  definition?: {
    name?: string;
    display_name?: string;
    description?: string;
    input_schema?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Scalekit tool provider adapter.
 *
 * Uses plain `fetch` against the Scalekit AgentKit REST API — zero external
 * SDK dependencies. Auth is OAuth 2.0 client_credentials with cached tokens.
 *
 * Discovery methods use filter params discovered from the Scalekit Node SDK
 * protobuf types and MCP server source:
 *   - `filter.provider`   — toolkit filter (with client-side fallback)
 *   - `filter.query`      — server-side text search
 *   - `filter.tool_name`  — exact tool name lookup (eliminates schema cache)
 *
 * Runtime method (`resolveTools`) fetches tool definitions in a single batch
 * call, converts JSON Schema inputs to Zod via `@mastra/schema-compat`, and
 * wraps each tool as a Mastra `ToolAction` with an execute-or-authorize pattern.
 */
export class ScalekitToolProvider implements ToolProvider {
  readonly info: ToolProviderInfo = {
    id: 'scalekit',
    name: 'Scalekit',
    description: 'Access third-party tools via Scalekit connected accounts',
  };

  private config: ScalekitToolProviderConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: ScalekitToolProviderConfig) {
    this.config = config;
  }

  // ── OAuth token management ──────────────────────────────────────────────

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const res = await fetch(`${this.config.envURL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Scalekit token request failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.token!;
  }

  private async apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.getToken();
    return fetch(`${this.config.envURL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  }

  // ── Discovery: list toolkits (providers) ────────────────────────────────

  async listToolkits(): Promise<ToolProviderListResult<ToolProviderToolkit>> {
    const res = await this.apiFetch('/api/v1/providers?page_size=100');
    if (!res.ok) throw new Error(`listToolkits failed (${res.status}): ${await res.text()}`);

    const body = await res.json();
    const providers = body.providers ?? [];
    const data: ToolProviderToolkit[] = providers.map((p: any) => ({
      slug: p.identifier,
      name: p.display_name,
      description: p.description ?? '',
      icon: p.icon_src,
    }));

    return {
      data,
      pagination: {
        total: body.total_size,
        hasMore: !!body.next_page_token,
      },
    };
  }

  // ── Discovery: list tools ───────────────────────────────────────────────

  async listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> {
    const perPage = options?.perPage ?? 50;
    const qs = new URLSearchParams({ page_size: String(perPage) });

    if (options?.toolkit) qs.set('filter.provider', options.toolkit);
    if (options?.search) qs.set('filter.query', options.search);

    const res = await this.apiFetch(`/api/v1/tools?${qs}`);
    if (!res.ok) throw new Error(`listTools failed (${res.status}): ${await res.text()}`);

    const body = await res.json();
    let tools: ScalekitRawTool[] = body.tools ?? [];

    // Provider filter fallback: if filter.provider returned 0 results,
    // retry without it and match client-side (from MCP server pattern).
    if (options?.toolkit && tools.length === 0) {
      const retryQs = new URLSearchParams({ page_size: String(perPage) });
      if (options?.search) retryQs.set('filter.query', options.search);

      const retryRes = await this.apiFetch(`/api/v1/tools?${retryQs}`);
      if (retryRes.ok) {
        const retryBody = await retryRes.json();
        const upper = options.toolkit.toUpperCase();
        tools = (retryBody.tools ?? []).filter(
          (t: ScalekitRawTool) => t.provider?.toUpperCase().includes(upper),
        );
      }
    }

    let mapped: ToolProviderToolInfo[] = tools.map(t => ({
      slug: t.definition?.name ?? t.id,
      name: t.definition?.display_name ?? t.definition?.name ?? t.id,
      description: t.definition?.description ?? '',
      toolkit: t.provider,
    }));

    // Client-side search as safety net alongside server-side filter.query
    if (options?.search) {
      const q = options.search.toLowerCase();
      mapped = mapped.filter(
        t =>
          t.slug.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false),
      );
    }

    return {
      data: mapped,
      pagination: {
        total: body.total_size,
        perPage,
        hasMore: !!body.next_page_token,
      },
    };
  }

  // ── Discovery: get tool schema ──────────────────────────────────────────

  async getToolSchema(toolSlug: string): Promise<Record<string, unknown> | null> {
    try {
      const qs = new URLSearchParams({
        page_size: '1',
        'filter.tool_name': toolSlug,
      });
      const res = await this.apiFetch(`/api/v1/tools?${qs}`);
      if (!res.ok) return null;

      const body = await res.json();
      const tools: ScalekitRawTool[] = body.tools ?? [];
      const match = tools.find(t => t.definition?.name === toolSlug) ?? tools[0];
      if (!match?.definition?.input_schema) return null;

      return match.definition.input_schema as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // ── Runtime: resolve executable tools ───────────────────────────────────

  async resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<any, any, any>>> {
    if (toolSlugs.length === 0) return {};

    const resourceId = options?.requestContext?.[MASTRA_RESOURCE_ID_KEY];
    const identifier = typeof resourceId === 'string' ? resourceId : (options?.userId ?? 'default');

    // Batch-fetch tool definitions using repeated filter.tool_name params
    const qs = new URLSearchParams({ page_size: String(Math.max(toolSlugs.length, 20)) });
    for (const name of toolSlugs) {
      qs.append('filter.tool_name', name);
    }

    const res = await this.apiFetch(`/api/v1/tools?${qs}`);
    if (!res.ok) return {};

    const body = await res.json();
    const rawTools: ScalekitRawTool[] = body.tools ?? [];

    // Index by definition name for O(1) lookup
    const toolsByName = new Map<string, ScalekitRawTool>();
    for (const t of rawTools) {
      const name = t.definition?.name;
      if (name) toolsByName.set(name, t);
    }

    const result: Record<string, ToolAction<any, any, any>> = {};

    for (const slug of toolSlugs) {
      const raw = toolsByName.get(slug);
      if (!raw?.definition) continue;

      const descOverride = toolConfigs?.[slug]?.description;
      const description = descOverride ?? raw.definition.description ?? '';
      const connector = raw.provider;

      // Convert JSON Schema to Zod using @mastra/schema-compat
      const inputSchema = raw.definition.input_schema
        ? convertSchemaToZod(raw.definition.input_schema as Record<string, unknown>)
        : undefined;

      result[slug] = {
        id: slug,
        description,
        inputSchema: inputSchema as ToolAction<any, any, any>['inputSchema'],
        execute: async ({ context }: { context: Record<string, unknown> }) => {
          return this.executeToolInternal({
            toolName: slug,
            input: context,
            identifier,
            connector,
          });
        },
      };
    }

    return result;
  }

  // ── Internal: execute with execute-or-authorize pattern ─────────────────

  private async executeToolInternal(params: {
    toolName: string;
    input: Record<string, unknown>;
    identifier: string;
    connector?: string;
  }): Promise<unknown> {
    const res = await this.apiFetch('/api/v1/execute_tool', {
      method: 'POST',
      body: JSON.stringify({
        tool_name: params.toolName,
        identifier: params.identifier,
        params: params.input,
        ...(params.connector && { connector: params.connector }),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();

      // Check if this is an auth error — try to generate a magic link
      const isAuthError = res.status === 400 || res.status === 404 || res.status === 403;
      const errLower = errorBody.toLowerCase();
      const looksLikeAuthIssue =
        errLower.includes('connected_account') ||
        errLower.includes('not_found') ||
        errLower.includes('not found') ||
        errLower.includes('authorization') ||
        errLower.includes('not authorized') ||
        errLower.includes('identifier');

      if (isAuthError && looksLikeAuthIssue) {
        const connector = params.connector ?? params.toolName.split('_')[0] ?? 'unknown';
        try {
          const authResult = await this.getAuthorizationURL({
            connector,
            identifier: params.identifier,
          });
          return {
            __authRequired: true,
            authUrl: authResult.link,
            expiry: authResult.expiry,
            connector,
            message: `User "${params.identifier}" needs to connect their ${connector} account.`,
          };
        } catch {
          // Magic link generation also failed — throw the original error
        }
      }

      throw new Error(`executeTool(${params.toolName}) failed (${res.status}): ${errorBody}`);
    }

    const result = await res.json();
    return result.data ?? result;
  }

  // ── Auth: magic link for connecting accounts ────────────────────────────

  async getAuthorizationURL(params: {
    connector: string;
    identifier: string;
    redirectURL?: string;
    state?: string;
  }): Promise<{ link: string; expiry: string }> {
    const res = await this.apiFetch('/api/v1/connected_accounts/magic_link', {
      method: 'POST',
      body: JSON.stringify({
        connector: params.connector,
        identifier: params.identifier,
        ...(params.redirectURL && { redirect_url: params.redirectURL }),
        ...(params.state && { state: params.state }),
      }),
    });

    if (!res.ok) throw new Error(`magic_link failed (${res.status}): ${await res.text()}`);
    return await res.json();
  }
}