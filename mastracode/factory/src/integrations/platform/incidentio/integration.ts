import type { MastraWorker } from '@mastra/core/worker';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type {
  CreateIntakeCommentInput,
  CreatedIntakeComment,
  GetIntakeIssueInput,
  Intake,
  IntakeIssue,
  IntakeIssueDetail,
  IntakeItemPage,
  IntakeSource,
  ListIntakeIssuesInput,
  ListIntakeItemsInput,
  ResolveIntakeDispatchInput,
  ResolvedIntakeDispatch,
  UpdateIntakeIssueInput,
} from '../../../capabilities/intake.js';
import type { FactoryIntegration, IntegrationContext } from '../../base.js';
import { IncidentioApiClient, IncidentioApiError } from '../../incidentio/api.js';
import {
  createIncidentioIntake,
  INCIDENTIO_FOLLOW_UPS_SOURCE_ID,
  INCIDENTIO_INCIDENTS_SOURCE_ID,
} from '../../incidentio/intake.js';
import { attachIncidentioIssueReconciler } from '../../incidentio/issue-reconciler.js';
import {
  incidentioReconciliationEnabled,
  incidentioReconciliationInterval,
} from '../../incidentio/reconciliation-config.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import { PlatformApiClient, platformApiClientConfigFromEnv, type PlatformApiClientConfig } from '../api-client.js';

export interface PlatformIncidentioIntegrationConfig {
  clientConfig?: PlatformApiClientConfig;
}

/**
 * Provider config key registered for incident.io in Mastra Platform's
 * integrations catalog. Connections are discovered at runtime — no
 * deploy-time connection ID wiring.
 */
const PLATFORM_INCIDENTIO_PROVIDER_CONFIG_KEY = 'incident-io';
const CONNECTION_TOKEN_PREFIX = 'incidentio-connection:';
const SCOPED_SOURCE_PREFIX = 'incidentio-source:';
const BASE_SOURCE_IDS = [INCIDENTIO_INCIDENTS_SOURCE_ID, INCIDENTIO_FOLLOW_UPS_SOURCE_ID] as const;

interface PlatformIntegrationConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

interface ScopedSourceId {
  connectionId: string;
  sourceId: string;
}

interface AggregatePageCursor {
  connection: number;
  inner?: string;
}

export function encodeScopedSourceId(connectionId: string, sourceId: string): string {
  return `${SCOPED_SOURCE_PREFIX}${Buffer.from(JSON.stringify({ connectionId, sourceId })).toString('base64url')}`;
}

export function decodeScopedSourceId(value: string): ScopedSourceId | null {
  if (!value.startsWith(SCOPED_SOURCE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value.slice(SCOPED_SOURCE_PREFIX.length), 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    return typeof parsed.connectionId === 'string' && typeof parsed.sourceId === 'string'
      ? { connectionId: parsed.connectionId, sourceId: parsed.sourceId }
      : null;
  } catch {
    return null;
  }
}

function incidentioConnection(connectionId: string): IntegrationConnection {
  return { type: 'oauth', accessToken: `${CONNECTION_TOKEN_PREFIX}${connectionId}` };
}

function connectionIdFromConnection(connection: IntegrationConnection): string | null {
  if (connection.type !== 'oauth' || !connection.accessToken.startsWith(CONNECTION_TOKEN_PREFIX)) return null;
  return connection.accessToken.slice(CONNECTION_TOKEN_PREFIX.length) || null;
}

/**
 * Base (per-connection) source ids selected for a connection. Scoped ids
 * select their own connection; legacy unscoped ids (`incidentio:incidents`)
 * from pre-discovery deploys apply to every connection.
 */
function baseSourceIdsFor(connectionId: string, sourceIds: string[]): string[] {
  const selected = new Set<string>();
  for (const sourceId of sourceIds) {
    const scoped = decodeScopedSourceId(sourceId);
    if (scoped) {
      if (scoped.connectionId === connectionId) selected.add(scoped.sourceId);
      continue;
    }
    if ((BASE_SOURCE_IDS as readonly string[]).includes(sourceId)) selected.add(sourceId);
  }
  return [...selected];
}

function encodePageCursor(cursor: AggregatePageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodePageCursor(cursor: string | undefined): AggregatePageCursor {
  if (!cursor) return { connection: 0 };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<AggregatePageCursor>;
    if (!Number.isSafeInteger(parsed.connection) || (parsed.connection ?? -1) < 0) return { connection: 0 };
    return {
      connection: parsed.connection!,
      ...(typeof parsed.inner === 'string' && parsed.inner ? { inner: parsed.inner } : {}),
    };
  } catch {
    return { connection: 0 };
  }
}

interface IncidentioConnectionContext {
  connection: PlatformIntegrationConnection;
  intake: Intake;
}

export class PlatformIncidentioIntegration implements FactoryIntegration {
  readonly id = 'incidentio';
  readonly #clientConfig: PlatformApiClientConfig;
  readonly #platformClient: PlatformApiClient;
  readonly #endpointHost: string;
  readonly #intakeByConnectionId = new Map<string, Intake>();

  constructor(config: PlatformIncidentioIntegrationConfig = {}) {
    this.#clientConfig = config.clientConfig ?? platformApiClientConfigFromEnv();
    this.#platformClient = new PlatformApiClient(this.#clientConfig);
    this.#endpointHost = new URL(this.#clientConfig.baseUrl).host;
  }

  async listConnections(): Promise<PlatformIntegrationConnection[]> {
    const providerKey = encodeURIComponent(PLATFORM_INCIDENTIO_PROVIDER_CONFIG_KEY);
    const result = await this.#platformClient.request<{ connections: PlatformIntegrationConnection[] }>(
      'GET',
      `/v2/connections?providerKey=${providerKey}`,
    );
    return result.connections;
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.#activeConnections()).length > 0;
  }

  clearCaches(): void {
    this.#intakeByConnectionId.clear();
  }

  async #activeConnections(): Promise<PlatformIntegrationConnection[]> {
    const connections = (await this.listConnections()).filter(connection => connection.status === 'active');
    // Stable ordering keeps aggregate page cursors valid across requests.
    return connections.slice().sort((left, right) => left.id.localeCompare(right.id));
  }

  #connectionIntake(connectionId: string): Intake {
    const cached = this.#intakeByConnectionId.get(connectionId);
    if (cached) return cached;
    const proxyBaseUrl = `${this.#clientConfig.baseUrl.replace(/\/+$/, '')}/v2/connections/${encodeURIComponent(
      connectionId,
    )}/proxy`;
    const intake = createIncidentioIntake({
      api: new IncidentioApiClient({
        baseUrl: proxyBaseUrl,
        accessToken: this.#clientConfig.accessToken,
        ...(this.#clientConfig.fetchImpl ? { fetchImpl: this.#clientConfig.fetchImpl } : {}),
      }),
      connection: incidentioConnection(connectionId),
    });
    this.#intakeByConnectionId.set(connectionId, intake);
    return intake;
  }

  async #connectionContexts(): Promise<IncidentioConnectionContext[]> {
    return (await this.#activeConnections()).map(connection => ({
      connection,
      intake: this.#connectionIntake(connection.id),
    }));
  }

  /**
   * Resolve the intake for an explicit connection token, or fall back to the
   * sole active connection so legacy single-connection callers keep working.
   */
  async #intakeForConnection(connection: IntegrationConnection): Promise<Intake> {
    const connectionId = connectionIdFromConnection(connection);
    if (connectionId) return this.#connectionIntake(connectionId);
    const active = await this.#activeConnections();
    if (active.length === 1) return this.#connectionIntake(active[0]!.id);
    throw new IncidentioApiError(
      active.length === 0
        ? 'incident.io connection is unavailable or requires reauthentication.'
        : 'incident.io request must identify a connection when multiple accounts are connected.',
      active.length === 0 ? 401 : 400,
    );
  }

  readonly intake: Intake = {
    resolveIntakeDispatch: input => this.#resolveIntakeDispatch(input),
    listSources: () => this.#listSources(),
    listItems: input => this.#listItems(input),
    listIssues: input => this.#listIssues(input),
    getIssue: input => this.#getIssue(input),
    createComment: input => this.#createComment(input),
    updateIssue: input => this.#updateIssue(input),
  };

  async #resolveIntakeDispatch(input: ResolveIntakeDispatchInput): Promise<ResolvedIntakeDispatch | null> {
    if (input.externalSource.type !== 'issue') return null;
    const externalId = input.externalSource.externalId;
    const contexts = await this.#connectionContexts();
    if (contexts.length === 0) return null;
    if (contexts.length === 1) {
      const resolved = await contexts[0]!.intake.resolveIntakeDispatch?.(input);
      return resolved ? this.#scopeResolvedDispatch(contexts[0]!.connection.id, resolved) : null;
    }
    // Multiple accounts: item references carry no connection id, so probe
    // each connection for the item — first account that knows it wins
    // (incident.io ids are globally unique ULIDs, collisions are not a
    // practical concern and this capability is read-mostly).
    let firstError: unknown;
    for (const context of contexts) {
      try {
        const issue = await context.intake.getIssue({
          connection: incidentioConnection(context.connection.id),
          issueId: externalId,
        });
        if (!issue) continue;
        const resolved = await context.intake.resolveIntakeDispatch?.(input);
        return resolved ? this.#scopeResolvedDispatch(context.connection.id, resolved) : null;
      } catch (error) {
        if (error instanceof IncidentioApiError && error.status === 404) continue;
        firstError ??= error;
      }
    }
    if (firstError !== undefined) throw firstError;
    return null;
  }

  #scopeResolvedDispatch(connectionId: string, resolved: ResolvedIntakeDispatch): ResolvedIntakeDispatch {
    return {
      ...resolved,
      connection: incidentioConnection(connectionId),
      ...(resolved.sourceId ? { sourceId: encodeScopedSourceId(connectionId, resolved.sourceId) } : {}),
    };
  }

  async #listSources(): Promise<IntakeSource[]> {
    const contexts = await this.#connectionContexts();
    const sources: IntakeSource[] = [];
    for (const context of contexts) {
      const account = context.connection.accountLabel;
      const inner = await context.intake.listSources({ orgId: '', userId: '' });
      for (const source of inner) {
        sources.push({
          ...source,
          id: encodeScopedSourceId(context.connection.id, source.id),
          name: contexts.length > 1 && account ? `${source.name} (${account})` : source.name,
          metadata: {
            ...(source.metadata ?? {}),
            connectionId: context.connection.id,
            ...(account ? { account } : {}),
          },
        });
      }
    }
    return sources;
  }

  async #listItems(input: ListIntakeItemsInput): Promise<IntakeItemPage> {
    if (input.sourceIds.length === 0) return { items: [], nextCursor: null };
    const contexts = await this.#connectionContexts();
    const cursor = decodePageCursor(input.cursor);

    for (let index = cursor.connection; index < contexts.length; index++) {
      const context = contexts[index]!;
      const baseSourceIds = baseSourceIdsFor(context.connection.id, input.sourceIds);
      if (baseSourceIds.length === 0) continue;
      const page = await context.intake.listItems({
        orgId: input.orgId,
        userId: input.userId,
        sourceIds: baseSourceIds,
        ...(index === cursor.connection && cursor.inner ? { cursor: cursor.inner } : {}),
      });
      const nextCursor = page.nextCursor
        ? encodePageCursor({ connection: index, inner: page.nextCursor })
        : index + 1 < contexts.length
          ? encodePageCursor({ connection: index + 1 })
          : null;
      return {
        items: page.items.map(item => ({
          ...item,
          sourceId: encodeScopedSourceId(context.connection.id, item.sourceId),
          metadata: { ...(item.metadata ?? {}), connectionId: context.connection.id },
        })),
        nextCursor,
      };
    }
    return { items: [], nextCursor: null };
  }

  async #listIssues(input: ListIntakeIssuesInput): Promise<{ issues: IntakeIssue[]; nextCursor: string | null }> {
    const intake = await this.#intakeForConnection(input.connection);
    const connectionId = connectionIdFromConnection(input.connection);
    const baseSourceIds = connectionId
      ? baseSourceIdsFor(connectionId, input.sourceIds)
      : input.sourceIds.map(sourceId => decodeScopedSourceId(sourceId)?.sourceId ?? sourceId);
    return intake.listIssues({
      ...input,
      connection: await this.#innerConnection(input.connection),
      sourceIds: baseSourceIds,
    });
  }

  async #getIssue(input: GetIntakeIssueInput): Promise<IntakeIssueDetail | null> {
    const intake = await this.#intakeForConnection(input.connection);
    return intake.getIssue({
      ...this.#withBaseSource(input),
      connection: await this.#innerConnection(input.connection),
    });
  }

  async #createComment(input: CreateIntakeCommentInput): Promise<CreatedIntakeComment | null> {
    const intake = await this.#intakeForConnection(input.connection);
    return intake.createComment({
      ...this.#withBaseSource(input),
      connection: await this.#innerConnection(input.connection),
    });
  }

  async #updateIssue(input: UpdateIntakeIssueInput): Promise<IntakeIssue | null> {
    const intake = await this.#intakeForConnection(input.connection);
    return intake.updateIssue({
      ...this.#withBaseSource(input),
      connection: await this.#innerConnection(input.connection),
    });
  }

  /** Per-connection intakes assert on the exact connection they minted. */
  async #innerConnection(connection: IntegrationConnection): Promise<IntegrationConnection> {
    const connectionId = connectionIdFromConnection(connection);
    if (connectionId) return incidentioConnection(connectionId);
    const active = await this.#activeConnections();
    if (active.length === 1) return incidentioConnection(active[0]!.id);
    return connection;
  }

  #withBaseSource<T extends { sourceId?: string }>(input: T): T {
    if (!input.sourceId) return input;
    const scoped = decodeScopedSourceId(input.sourceId);
    return scoped ? { ...input, sourceId: scoped.sourceId } : input;
  }

  workers(ctx: IntegrationContext): MastraWorker[] {
    if (!incidentioReconciliationEnabled()) return [];
    const reconcile = attachIncidentioIssueReconciler(this, ctx);
    if (!reconcile) return [];
    const intervalMs = incidentioReconciliationInterval();
    return [
      new IssueReconcileWorker({
        integrationId: this.id,
        reconcile,
        ...(intervalMs ? { intervalMs } : {}),
      }),
    ];
  }

  routes(): [] {
    return [];
  }

  diagnostics(): Record<string, unknown> {
    return { configured: true, mode: 'platform', endpointHost: this.#endpointHost };
  }
}
