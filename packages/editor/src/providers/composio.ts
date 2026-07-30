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
  ToolProviderCapabilities,
  ToolProviderHealth,
  ToolProviderInfo,
  ToolProviderToolkit,
  BaseToolProviderOptions,
} from '@mastra/core/tool-provider';
import { BaseToolProvider } from '@mastra/core/tool-provider';
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

export interface ComposioToolProviderConfig extends BaseToolProviderOptions {
  /** Composio API key. */
  apiKey: string;
}

const COMPOSIO_PROVIDER_ID = 'composio' as const;
const DEFAULT_INTERNAL_USER_ID = 'default';

/**
 * Composio implementation of the {@link BaseToolProvider} contract.
 *
 * Discovery (`listAllToolkits`, `listAllTools`) uses the raw Composio
 * client. Runtime (`resolveToolsVNext`) uses {@link MastraProvider} so resolved
 * tools are already in `createTool()` shape; each tool gets a
 * `beforeExecute` modifier that injects
 * `connectedAccountId = connectionId`, and `outputSchema` is cleared
 * because Composio returns union schemas that Mastra's runtime rejects.
 *
 * Allowlist filtering is layered by {@link BaseToolProvider}; this class
 * never reads `allowedToolkits` / `allowedTools` directly.
 */
export class ComposioToolProvider extends BaseToolProvider {
  readonly info: ToolProviderInfo = {
    id: COMPOSIO_PROVIDER_ID,
    name: 'Composio',
    description: 'Access 10,000+ tools from 150+ apps via Composio',
  };
  readonly capabilities: ToolProviderCapabilities = {
    multipleConnectionsPerToolkit: true,
    batchConnectionStatus: true,
    reauthorizeReusesConnectionId: true,
    supportsRevoke: true,
  };

  private readonly apiKey: string;
  private rawClient: Composio | null = null;
  private mastraClient: Composio<MastraProvider> | null = null;

  constructor(config: ComposioToolProviderConfig) {
    super({
      allowedToolkits: config.allowedToolkits,
      allowedTools: config.allowedTools,
      defaultScope: config.defaultScope,
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

  // ── catalog (BaseToolProvider adds allowlist filter on top) ───────────

  protected async listAllToolkits(): Promise<ToolProviderToolkit[]> {
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
    // When the caller doesn't scope to a specific toolkit, we fall back to
    // the admin allowlist so the SDK returns a flat list across allowed
    // toolkits in a single hop (vs. fanning out per toolkit).
    const limit = opts.perPage;
    const fallbackToolkits = this.allowedToolkits.length > 0 ? [...this.allowedToolkits] : undefined;
    const query: ComposioToolListParams = (
      opts.toolkit
        ? { toolkits: [opts.toolkit], limit, search: opts.search }
        : fallbackToolkits
          ? { toolkits: fallbackToolkits, limit, search: opts.search }
          : opts.search
            ? { search: opts.search, limit }
            : { toolkits: [] as string[], limit }
    ) as ComposioToolListParams;

    // Composio's SDK validates every tool's input/output schema against an
    // internal zod shape and throws on the first malformed tool — so one bad
    // toolkit can poison a multi-toolkit query. Treat validation errors as a
    // soft failure and return an empty page rather than a 500.
    let rawTools: ComposioTool[] = [];
    try {
      rawTools = await composio.tools.getRawComposioTools(query);
    } catch (err) {
      console.warn(
        `[ComposioToolProvider] listAllTools failed for query ${JSON.stringify(query)} — returning empty page`,
        err,
      );
    }

    const data = rawTools.map(tool => ({
      slug: tool.slug,
      name: tool.name ?? tool.slug,
      description: tool.description,
      toolkit: tool.toolkit?.slug ?? opts.toolkit ?? '',
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

  async resolveToolsVNext(opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>> {
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
        // Under `caller-supplied` scope the user bucket (`internalUserId`,
        // resolved from the host app's resourceId) already scopes the call to
        // the right tenant. Pinning a specific `connectedAccountId` would defeat
        // Composio's per-user-bucket auto-resolve, so we let Composio pick the
        // connected account within the bucket instead of forcing one.
        if (opts.scope !== 'caller-supplied') {
          params.connectedAccountId = opts.connectionId;
        }
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
    const { id: authConfigId, authScheme } = await this.resolveAuthConfig(opts.toolkit);

    // `connectionId` carries the internal user bucket for the runtime fan-out;
    // for authorize we treat it as the Composio `userId` so the new connected
    // account lands under the same bucket as the agent's resolved identity.
    const internalUserId = opts.connectionId || DEFAULT_INTERNAL_USER_ID;

    // `config` carries provider-specific user-supplied fields (e.g. Confluence
    // subdomain) collected by the picker via `listConnectionFields`. When it is
    // present we must use `connectedAccounts.initiate`, which accepts a
    // discriminated `{ authScheme, val }` config for programmatic account
    // creation. Composio's non-deprecated `connectedAccounts.link` (hosted
    // Connect Link) has no `config` parameter, so it cannot carry these fields.
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

    // Prefer `link` for the Composio-managed OAuth redirect flow: `initiate`
    // is deprecated for managed OAuth. `link` allows multiple connected
    // accounts per (user, auth config) by default, so we no longer pass
    // `allowMultiple`. Fall back to `initiate` only when custom `config` fields
    // are supplied, since `link` cannot forward them.
    const request = initiateConfig
      ? await composio.connectedAccounts.initiate(internalUserId, authConfigId, {
          allowMultiple: true,
          config: initiateConfig,
        })
      : await composio.connectedAccounts.link(internalUserId, authConfigId);

    if (!request.redirectUrl) {
      throw new Error(`[composio] authorize did not return a redirectUrl for toolkit "${opts.toolkit}"`);
    }

    return { url: request.redirectUrl, authId: request.id };
  }

  async listConnectionFields({ toolkit }: { toolkit: string }): Promise<ConnectionField[]> {
    const composio = this.getRawClient();
    const { authScheme } = await this.resolveAuthConfig(toolkit);
    if (!authScheme) {
      // Without a known auth scheme we can't query the field schema — fall
      // back to no fields rather than blocking the user.
      return [];
    }
    const fields = await composio.toolkits.getConnectedAccountInitiationFields(toolkit, authScheme, {
      requiredOnly: false,
    });
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
    items: Array<{ connectionId: string; toolkit: string }>;
  }): Promise<Record<string, { connected: boolean }>> {
    if (opts.items.length === 0) return {};

    const composio = this.getRawClient();
    const toolkitSlugs = Array.from(new Set(opts.items.map(i => i.toolkit)));

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
    const page = opts.page ?? 1;
    const perPage = clampLimit(opts.perPage);

    // Normalize userIds[] / userId. Empty array = no buckets to list against,
    // short-circuit to avoid an unbounded Composio response.
    const userIds = resolveUserIds(opts);
    if (userIds && userIds.length === 0) {
      return { items: [], pagination: { page, perPage, hasMore: false } };
    }

    // Composio SDK 0.6.x uses cursor-based pagination on the wire. We surface
    // page-based pagination to keep the Mastra contract consistent with every
    // other list API. For now we only fetch the first page (page=1); paginated
    // requests for page > 1 are a follow-up — the UI does not yet paginate.
    const list: ConnectedAccountListResponse = await composio.connectedAccounts.list({
      toolkitSlugs: [opts.toolkit],
      ...(userIds ? { userIds } : {}),
      limit: perPage,
    });

    // Defensive: tolerate undocumented SDK shape drift where `items` is
    // missing or `nextCursor` is `null`/`undefined`/`''`.
    const items: ExistingConnection[] = (list.items ?? []).map(account => ({
      connectionId: account.id,
      status: mapComposioStatus(account.status, account.isDisabled),
      createdAt: account.createdAt,
      // `user_id` is preserved by the Composio SDK transform via spread but
      // isn't on the typed shape. Read it via a narrow cast.
      authorId: (account as unknown as { user_id?: string }).user_id,
    }));

    const nextCursor = (list as { nextCursor?: string | null }).nextCursor ?? null;
    const hasMore = typeof nextCursor === 'string' && nextCursor.length > 0;
    return { items, pagination: { page, perPage, hasMore } };
  }

  /**
   * Revoke a Composio connected account via
   * `DELETE /api/v3/connected_accounts/:nanoid`. Composio performs a soft
   * delete and responds with `{ success: boolean }`.
   *
   * Treats a 404 (account already deleted or never existed) as success so
   * the caller can drop its local pin without an error path. A `success:
   * false` response means the provider refused the delete and is surfaced
   * as an error so the caller does not delete its local row.
   */
  async revokeConnection(connectionId: string): Promise<void> {
    const composio = this.getRawClient();
    try {
      const res = (await composio.connectedAccounts.delete(connectionId)) as { success?: boolean } | undefined;
      if (res && res.success === false) {
        throw new Error(`Composio refused to delete connected account ${connectionId} (success=false)`);
      }
    } catch (err) {
      if (isNotFoundError(err)) return;
      throw err;
    }
  }

  async getHealth(): Promise<ToolProviderHealth> {
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
   * Resolve the single ENABLED auth config for `toolkit`. Throws if zero
   * or multiple configs match — the admin must enable exactly one in the
   * Composio dashboard before agents can connect.
   */
  private async resolveAuthConfig(toolkit: string): Promise<{ id: string; authScheme?: ComposioAuthScheme }> {
    const composio = this.getRawClient();
    const response = await composio.authConfigs.list({ toolkit });
    const enabled = response.items.filter(item => item.status === 'ENABLED');

    if (enabled.length === 0) {
      throw new Error(
        `[composio] No ENABLED auth config for toolkit "${toolkit}". Enable one in the Composio dashboard.`,
      );
    }
    if (enabled.length > 1) {
      const ids = enabled.map(item => item.id).join(', ');
      throw new Error(
        `[composio] Multiple ENABLED auth configs for toolkit "${toolkit}" (${ids}). Keep exactly one enabled.`,
      );
    }
    return { id: enabled[0]!.id, authScheme: enabled[0]!.authScheme };
  }
}

type ComposioAuthScheme = NonNullable<
  Awaited<ReturnType<Composio['authConfigs']['list']>>['items'][number]['authScheme']
>;

/**
 * Best-effort 404 detection across the various error shapes the Composio
 * SDK surfaces (typed error with `statusCode`, HTTP-like error with
 * `status`, or a plain message containing "404" / "not found").
 */
function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { statusCode?: number; status?: number; message?: string };
  if (e.statusCode === 404 || e.status === 404) return true;
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  return msg.includes('not found') || msg.includes('404');
}

/**
 * Composio reports a free-form `type` string. Map common values to our
 * generic ConnectionField type vocabulary; everything else falls back to
 * `'string'`.
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
function mapComposioStatus(status: string, isDisabled: boolean): ExistingConnection['status'] {
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

// Mirror of `MASTRA_USER_KEY` from `@mastra/server`. Inlined to avoid a
// reverse dependency from `editor` onto `server`.
const MASTRA_USER_KEY = 'mastra__user';

/**
 * Read the internal user id (Composio `userId`) from per-request context.
 *
 * The runtime fan-out is responsible for stamping the agent's resolved
 * author id (or `'default'`) into `requestContext` under
 * {@link MASTRA_RESOURCE_ID_KEY}.
 */
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

/**
 * Resolve `userIds[]` from `listConnections` opts.
 *
 * - If `userIds` is provided, use it as-is (including empty array, which
 *   means "no buckets to list against").
 * - If `userId` is provided, normalize to `[userId]`.
 * - Otherwise fall back to the default internal user id (single-bucket).
 */
function resolveUserIds(opts: ListConnectionsOpts): string[] | undefined {
  if (Array.isArray(opts.userIds)) return opts.userIds;
  if (typeof opts.userId === 'string' && opts.userId.length > 0) return [opts.userId];
  return [DEFAULT_INTERNAL_USER_ID];
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_LIMIT);
}
