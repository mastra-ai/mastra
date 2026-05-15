import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ConnectionField,
  ExistingConnection,
  ListConnectionsOpts,
  ListConnectionsResult,
  ListToolsOpts,
  ListToolsResult,
  ResolveToolsOpts,
  ToolIntegrationCapabilities,
  ToolIntegrationHealth,
  ToolService,
} from '@mastra/core/tool-integration';
import { BaseToolIntegration } from '@mastra/core/tool-integration';
import type { BaseToolIntegrationOptions } from '@mastra/core/tool-integration';
import type { ToolAction } from '@mastra/core/tools';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';

import { Composio } from '@composio/core';
import type {
  ConnectedAccountListResponse,
  Tool as ComposioTool,
  ToolListParams as ComposioToolListParams,
  ToolKitItem,
} from '@composio/core';
import { MastraProvider } from '@composio/mastra';
import type { MastraToolCollection } from '@composio/mastra';

export interface ComposioToolIntegrationConfig extends BaseToolIntegrationOptions {
  /** Composio API key. */
  apiKey: string;
}

const COMPOSIO_INTEGRATION_ID = 'composio' as const;
const DEFAULT_INTERNAL_USER_ID = 'default';

/**
 * Composio implementation of the {@link BaseToolIntegration} contract.
 *
 * Discovery (`listAllToolServices`, `listAllTools`) uses the raw Composio
 * client. Runtime (`resolveTools`) uses {@link MastraProvider} so resolved
 * tools are already in `createTool()` shape; each tool gets a
 * `beforeExecute` modifier that injects
 * `connectedAccountId = connectionId`, and `outputSchema` is cleared
 * because Composio returns union schemas that Mastra's runtime rejects.
 *
 * Allowlist filtering is layered by {@link BaseToolIntegration}; this class
 * never reads `allowedToolServices` / `allowedTools` directly.
 */
export class ComposioToolIntegration extends BaseToolIntegration {
  readonly id = COMPOSIO_INTEGRATION_ID;
  readonly displayName = 'Composio';
  readonly capabilities: ToolIntegrationCapabilities = {
    multipleConnectionsPerService: true,
    batchConnectionStatus: true,
    reauthorizeReusesConnectionId: true,
  };

  private readonly apiKey: string;
  private rawClient: Composio | null = null;
  private mastraClient: Composio<MastraProvider> | null = null;

  constructor(config: ComposioToolIntegrationConfig) {
    super({
      allowedToolServices: config.allowedToolServices,
      allowedTools: config.allowedTools,
    });
    this.apiKey = config.apiKey;
  }

  // ── client cache ──────────────────────────────────────────────────────

  private getRawClient(): Composio {
    if (!this.rawClient) {
      this.rawClient = new Composio({ apiKey: this.apiKey });
    }
    return this.rawClient;
  }

  private getMastraClient(): Composio<MastraProvider> {
    if (!this.mastraClient) {
      this.mastraClient = new Composio({
        apiKey: this.apiKey,
        provider: new MastraProvider(),
      });
    }
    return this.mastraClient;
  }

  // ── catalog (BaseToolIntegration adds allowlist filter on top) ────────

  protected async listAllToolServices(): Promise<ToolService[]> {
    const composio = this.getRawClient();
    const toolkits: ToolKitItem[] = await composio.toolkits.get({});
    return toolkits.map(tk => ({
      slug: tk.slug,
      name: tk.name,
      description: tk.meta?.description,
      icon: tk.meta?.logo,
    }));
  }

  protected async listAllTools(opts: ListToolsOpts): Promise<ListToolsResult> {
    const composio = this.getRawClient();

    // Composio's `getRawComposioTools` query is a discriminated union — every
    // variant accepts `limit`, but the toolkits/search keys are exclusive in
    // the TS types. We build the variant we need, then cast to the union.
    //
    // When the caller doesn't scope to a specific toolService, we fall back
    // to the admin allowlist so the SDK returns a flat list across allowed
    // toolkits in a single hop (vs. fanning out per service).
    const limit = opts.perPage;
    const fallbackToolkits = this.allowedToolServices.length > 0 ? [...this.allowedToolServices] : undefined;
    const query: ComposioToolListParams = (
      opts.toolService
        ? { toolkits: [opts.toolService], limit, search: opts.search }
        : fallbackToolkits
          ? { toolkits: fallbackToolkits, limit, search: opts.search }
          : opts.search
            ? { search: opts.search, limit }
            : { toolkits: [] as string[], limit }
    ) as ComposioToolListParams;

    const rawTools: ComposioTool[] = await composio.tools.getRawComposioTools(query);

    const data = rawTools.map(tool => ({
      slug: tool.slug,
      name: tool.name ?? tool.slug,
      description: tool.description,
      toolService: tool.toolkit?.slug ?? opts.toolService ?? '',
    }));

    return {
      data,
      pagination: {
        page: opts.page ?? 1,
        perPage: limit,
        hasMore: limit !== undefined && rawTools.length >= limit,
      },
    };
  }

  // ── runtime ───────────────────────────────────────────────────────────

  async resolveTools(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>> {
    if (opts.toolSlugs.length === 0) return {};

    // For author-bound connections, the runtime fan-out passes the agent's
    // author id explicitly. Use it as the Composio user bucket so the pin
    // resolves for any invoker (not just the original author).
    const internalUserId =
      opts.authorId && opts.authorId.length > 0 ? opts.authorId : resolveInternalUserId(opts.requestContext);
    const composio = this.getMastraClient();

    const modifiers = {
      // `connectedAccountId` is not threaded through Composio's `execute`
      // option bag in @composio/mastra; the only documented per-call hook
      // is `beforeExecute`, which receives the params object that flows
      // into the API call. Mutating `params.connectedAccountId` routes
      // the call to a specific account.
      beforeExecute: ({ params }: { params: { connectedAccountId?: string; userId?: string } }) => {
        params.connectedAccountId = opts.connectionId;
        return params;
      },
    };

    const mastraTools = (await composio.tools.get(
      internalUserId,
      { tools: opts.toolSlugs },
      modifiers,
    )) as MastraToolCollection;

    const result: Record<string, ToolAction<any, any, any>> = {};

    for (const [key, tool] of Object.entries(mastraTools ?? {})) {
      if (!tool) continue;
      const slug = (tool as { id?: string }).id ?? key;

      // Composio returns union output schemas (`successful: true | false`) that
      // Mastra's runtime cannot validate; clearing avoids per-tool validation
      // errors at execute time. The property may be non-writable on some SDK
      // versions, so we swallow assignment errors.
      try {
        (tool as unknown as { outputSchema: unknown }).outputSchema = undefined;
      } catch {
        // ignore
      }

      const descOverride = opts.toolMeta?.[slug]?.description;
      if (descOverride) {
        try {
          (tool as unknown as { description: string }).description = descOverride;
        } catch {
          // ignore
        }
      }

      result[slug] = tool as ToolAction<any, any, any>;
    }

    return result;
  }

  // ── auth surface ──────────────────────────────────────────────────────

  async authorize(opts: AuthorizeOpts): Promise<{ url: string; authId: string }> {
    const composio = this.getRawClient();
    const { id: authConfigId, authScheme } = await this.resolveAuthConfig(opts.toolService);

    // `connectionId` carries the internal user bucket for the runtime fan-out;
    // for authorize we treat it as the Composio `userId` so the new connected
    // account lands under the same bucket as the agent's resolved identity.
    const internalUserId = opts.connectionId || DEFAULT_INTERNAL_USER_ID;
    // `allowMultiple: true` — we explicitly support N connected accounts per
    // (user, auth config) and disambiguate at runtime via per-connection labels.
    // `config` carries provider-specific user-supplied fields (e.g. Confluence
    // subdomain) collected by the picker via `listConnectionFields`. Composio
    // expects a discriminated `{ authScheme, val }` shape; we cast through
    // `unknown` because our generic interface keeps it Record-shaped.
    const initiateConfig =
      opts.config && Object.keys(opts.config).length > 0 && authScheme
        ? ({ authScheme, val: opts.config } as unknown as Parameters<
            typeof composio.connectedAccounts.initiate
          >[2] extends infer O
            ? O extends { config?: infer C }
              ? C
              : never
            : never)
        : undefined;
    const request = await composio.connectedAccounts.initiate(internalUserId, authConfigId, {
      allowMultiple: true,
      ...(initiateConfig ? { config: initiateConfig } : {}),
    });

    if (!request.redirectUrl) {
      throw new Error(
        `[composio] initiate did not return a redirectUrl for tool service "${opts.toolService}"`,
      );
    }

    return { url: request.redirectUrl, authId: request.id };
  }

  async listConnectionFields({ toolService }: { toolService: string }): Promise<ConnectionField[]> {
    const composio = this.getRawClient();
    const { authScheme } = await this.resolveAuthConfig(toolService);
    if (!authScheme) {
      // Without a known auth scheme we can't query the field schema — fall
      // back to no fields rather than blocking the user.
      return [];
    }
    const fields = await composio.toolkits.getConnectedAccountInitiationFields(
      toolService,
      authScheme,
      { requiredOnly: false },
    );
    return fields.map(f => ({
      name: f.name,
      displayName: f.displayName,
      description: f.description,
      type: coerceFieldType(f.type),
      required: f.required ?? false,
      default: f.default ?? undefined,
    }));
  }

  async getAuthStatus(authId: string): Promise<AuthFlowStatus> {
    const composio = this.getRawClient();
    const account = await composio.connectedAccounts.get(authId);
    switch (account.status) {
      case 'ACTIVE':
        return 'completed';
      case 'INITIALIZING':
      case 'INITIATED':
        return 'pending';
      case 'FAILED':
      case 'EXPIRED':
      case 'INACTIVE':
        return 'failed';
      default:
        return 'pending';
    }
  }

  async getConnectionStatus(opts: {
    items: Array<{ connectionId: string; toolService: string }>;
  }): Promise<Record<string, { connected: boolean }>> {
    if (opts.items.length === 0) return {};

    const composio = this.getRawClient();
    const toolkitSlugs = Array.from(new Set(opts.items.map(i => i.toolService)));

    // One SDK call per `getConnectionStatus`, regardless of N items.
    // Filter by all referenced toolkits, then bucket locally by id.
    const list: ConnectedAccountListResponse = await composio.connectedAccounts.list({
      toolkitSlugs,
    });

    const liveById = new Map<string, { status: string; isDisabled: boolean }>();
    for (const item of list.items) {
      liveById.set(item.id, { status: item.status, isDisabled: item.isDisabled });
    }

    const result: Record<string, { connected: boolean }> = {};
    for (const { connectionId } of opts.items) {
      const live = liveById.get(connectionId);
      result[connectionId] = { connected: live ? live.status === 'ACTIVE' && !live.isDisabled : false };
    }
    return result;
  }

  async listConnections(opts: ListConnectionsOpts): Promise<ListConnectionsResult> {
    const composio = this.getRawClient();
    const userId = opts.userId || DEFAULT_INTERNAL_USER_ID;

    const list: ConnectedAccountListResponse = await composio.connectedAccounts.list({
      toolkitSlugs: [opts.toolService],
      userIds: [userId],
    });

    const items: ExistingConnection[] = list.items.map(account => ({
      connectionId: account.id,
      status: mapComposioStatus(account.status, account.isDisabled),
      createdAt: account.createdAt,
    }));

    return { items };
  }

  async getHealth(): Promise<ToolIntegrationHealth> {
    try {
      const composio = this.getRawClient();
      await composio.toolkits.get({ limit: 1 } as Parameters<typeof composio.toolkits.get>[0]);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Composio SDK reachability check failed',
      };
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────

  /**
   * Resolve the single ENABLED auth config for `toolService`. Throws if zero
   * or multiple configs match — the admin must enable exactly one in the
   * Composio dashboard before agents can connect.
   */
  private async resolveAuthConfig(
    toolService: string,
  ): Promise<{ id: string; authScheme?: ComposioAuthScheme }> {
    const composio = this.getRawClient();
    const response = await composio.authConfigs.list({ toolkit: toolService });
    const enabled = response.items.filter(item => item.status === 'ENABLED');

    if (enabled.length === 0) {
      throw new Error(
        `[composio] No ENABLED auth config for tool service "${toolService}". Enable one in the Composio dashboard.`,
      );
    }
    if (enabled.length > 1) {
      const ids = enabled.map(item => item.id).join(', ');
      throw new Error(
        `[composio] Multiple ENABLED auth configs for tool service "${toolService}" (${ids}). Keep exactly one enabled.`,
      );
    }
    return { id: enabled[0]!.id, authScheme: enabled[0]!.authScheme };
  }
}

type ComposioAuthScheme = NonNullable<
  Awaited<ReturnType<Composio['authConfigs']['list']>>['items'][number]['authScheme']
>;

/**
 * Composio reports a free-form `type` string (e.g. `'string'`, `'text'`,
 * `'number'`, `'bool'`). Map common values to our generic ConnectionField
 * type vocabulary; everything else falls back to `'string'`.
 */
function coerceFieldType(type: string): 'string' | 'number' | 'boolean' {
  switch (type.toLowerCase()) {
    case 'number':
    case 'integer':
    case 'int':
    case 'float':
      return 'number';
    case 'bool':
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

/**
 * Map Composio account status + `isDisabled` to the {@link ExistingConnection}
 * status vocabulary surfaced to the picker UI.
 */
function mapComposioStatus(
  status: string,
  isDisabled: boolean,
): ExistingConnection['status'] {
  if (isDisabled) return 'inactive';
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INITIALIZING':
    case 'INITIATED':
      return 'pending';
    case 'FAILED':
    case 'EXPIRED':
      return 'failed';
    case 'INACTIVE':
      return 'inactive';
    default:
      return 'pending';
  }
}

/**
 * Read the internal user id (Composio `userId`) from per-request context.
 *
 * The runtime fan-out (Phase 4) is responsible for stamping the agent's
 * resolved author id (or `'default'`) into `requestContext` under
 * {@link MASTRA_RESOURCE_ID_KEY}. The adapter never reads `storedAgent`
 * directly — that keeps Composio agnostic to agent-level binding modes.
 */
// Mirror of `MASTRA_USER_KEY` from `@mastra/server`. Inlined to avoid a
// reverse dependency from `editor` onto `server`.
const MASTRA_USER_KEY = 'mastra__user';

function resolveInternalUserId(requestContext?: Record<string, unknown>): string {
  const resourceId = requestContext?.[MASTRA_RESOURCE_ID_KEY];
  if (typeof resourceId === 'string' && resourceId.length > 0) {
    return resourceId;
  }

  const user = requestContext?.[MASTRA_USER_KEY];
  if (user && typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }

  return DEFAULT_INTERNAL_USER_ID;
}
