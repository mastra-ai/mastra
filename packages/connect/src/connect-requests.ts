import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Agent } from '@mastra/core/agent';
import type { ChannelProvider } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import { nestUnderRun } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { WebhookSignalProvider } from '@mastra/core/signals';
import type { ChannelConfig, ChannelsStorage } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationCatalogEntry, ProjectConnection, ResolvedClient } from './client.js';
import { createConnectSession, listProjectConnections } from './client.js';
import { runUntraced } from './instrumentation.js';

export const CONNECT_REQUEST_PART = 'data-mastra-connect-request';
export const CONNECT_SIGNAL_SOURCE = 'mastra-connect';
export const CONNECT_INTEGRATION_TOOL = 'connect_integration';
const CONNECT_DONE_PATH = '/connect/done';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const POLL_INTERVAL_MS = 2_000;
const REFRESH_WAIT_MS = 3_000;
const MAX_WEBHOOK_BYTES = 64 * 1024;
const CHANNEL_REQUEST_TTL_MS = 15 * 60_000;

export type ConnectRequestData = {
  requestId: string;
  integration: string;
  displayName: string;
  logoUrl?: string;
  reason: string;
  connectionId: string;
  connectUrl: string;
  expiresAt: string;
  agentId: string;
  threadId: string;
  resourceId: string;
  trace?: { traceId: string; spanId: string };
};

export type ConnectSignalAttributes = {
  source: typeof CONNECT_SIGNAL_SOURCE;
  connectRequestId: string;
  connectionId: string;
  integration: string;
  outcome: 'connected' | 'failed';
  accountLabel?: string;
};

export interface RequestConnectionsContext {
  requestContext: RequestContext;
  agentId?: string;
  threadId?: string;
  resourceId?: string;
}

export interface RequestConnectionsOptions {
  allow(ctx: RequestConnectionsContext): boolean | Promise<boolean>;
  channels?: string[];
}

const connectEventSchema = z.object({
  key: z.string(),
  projectId: z.string(),
  type: z.enum(['connection.active', 'connection.failed']),
  connection: z.object({ id: z.string(), integrationId: z.string(), accountLabel: z.string().nullish() }),
  error: z.object({ code: z.string() }).nullish(),
  context: z.object({
    requestId: z.string(),
    agentId: z.string(),
    threadId: z.string(),
    resourceId: z.string(),
    integration: z.string(),
    trace: z.object({ traceId: z.string(), spanId: z.string() }).optional(),
  }),
});

export type ConnectEvent = z.infer<typeof connectEventSchema>;

const pendingInstallSchema = z.object({
  requests: z.array(z.object({ context: connectEventSchema.shape.context, expiresAt: z.number() })),
});
type PendingStore = Pick<ChannelsStorage, 'getConfig' | 'saveConfig' | 'deleteConfig'>;

export interface ConnectRequestHost {
  client: ResolvedClient;
  projectId: string;
  allow: RequestConnectionsOptions['allow'];
  webhookUrl: string | undefined;
  webhookSecret: string | undefined;
  integrations: string[];
  channels: string[];
  pendingInstalls: Map<string, ChannelConfig>;
  reconciling: Set<string>;
  disposers: Set<() => void>;
  refresh(): Promise<unknown>;
  catalog(): IntegrationCatalogEntry[];
}

function displayNameOf(host: ConnectRequestHost, integrationId: string): string {
  return host.catalog().find(entry => entry.id === integrationId)?.displayName ?? integrationId;
}

export function verifyConnectSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const fields = new Map(
    (header ?? '').split(',').map(field => {
      const index = field.indexOf('=');
      return [field.slice(0, index).trim(), field.slice(index + 1).trim()] as const;
    }),
  );
  const timestamp = fields.get('t') ?? '';
  const given = Buffer.from(fields.get('v1') ?? '', 'hex');
  if (!/^\d+$/.test(timestamp) || Math.abs(nowMs / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type DeliverOutcome = 'delivered' | 'duplicate' | 'in_flight' | 'rejected' | 'failed';

const OUTCOME_STATUS: Record<DeliverOutcome, 200 | 403 | 503> = {
  delivered: 200,
  duplicate: 200,
  in_flight: 503,
  rejected: 403,
  failed: 503,
};

const connectProviders = new Map<string, ConnectSignalProvider>();

export type InstalledChannel = { id: string; agentId: string };

export const channelRefreshers = new Set<() => Promise<Record<string, ChannelProvider>>>();

export function notifyChannelInstalled(platform: string, installation: InstalledChannel): void {
  void connectProviders.get(installation.agentId)?.completeInstall(platform, installation.id);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const pendingKey = (installationId: string) => `mastra-connect:pending:${installationId}`;

async function pendingStore(
  host: ConnectRequestHost,
  mastra: Pick<Mastra, 'getStorage'> | undefined,
  warn = false,
): Promise<PendingStore> {
  const store = await mastra?.getStorage()?.getStore('channels');
  if (store) return store;
  if (warn) {
    console.warn(
      '[@mastra/connect] No channels storage domain: a channel install that finishes on another instance will not wake the thread.',
    );
  }
  return {
    getConfig: async key => host.pendingInstalls.get(key) ?? null,
    saveConfig: async config => void host.pendingInstalls.set(config.platform, config),
    deleteConfig: async key => void host.pendingInstalls.delete(key),
  };
}

export class ConnectSignalProvider extends WebhookSignalProvider {
  readonly #host: ConnectRequestHost;
  readonly #completed = new Set<string>();
  readonly #inFlight = new Set<string>();

  constructor(host: ConnectRequestHost) {
    super({ id: CONNECT_SIGNAL_SOURCE, name: 'Mastra Connect' });
    this.#host = host;
  }

  connect(agent: Agent<any, any, any, any>): void {
    super.connect(agent);
    connectProviders.set(agent.id, this);
    this.#host.disposers.add(() => {
      if (connectProviders.get(agent.id) === this) connectProviders.delete(agent.id);
    });
  }

  async completeInstall(platform: string, installationId: string): Promise<void> {
    try {
      const store = await pendingStore(this.#host, this.mastra);
      const pending = await store.getConfig(pendingKey(installationId));
      if (!pending) return;
      await store.deleteConfig(pendingKey(installationId));
      for (const { context, expiresAt } of pendingInstallSchema.parse(pending.data).requests) {
        const event: ConnectEvent = {
          key: `${installationId}:${context.requestId}:active`,
          projectId: this.#host.projectId,
          type: 'connection.active',
          connection: { id: installationId, integrationId: platform },
          error: null,
          context,
        };
        void pollUntil(this.#host, expiresAt, async () => !retryable(await this.deliver(event)));
      }
    } catch (error) {
      console.warn(
        `[@mastra/connect] Could not finish the ${platform} install: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deliver(event: ConnectEvent): Promise<DeliverOutcome> {
    if (this.#completed.has(event.key)) return 'duplicate';
    if (this.#inFlight.has(event.key)) return 'in_flight';
    this.#inFlight.add(event.key);
    try {
      const outcome = await this.#wake(event);
      if (outcome === 'delivered' || outcome === 'duplicate') this.#completed.add(event.key);
      return outcome;
    } catch (error) {
      console.warn(
        `[@mastra/connect] Could not report the ${event.context.integration} connection result: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'failed';
    } finally {
      this.#inFlight.delete(event.key);
    }
  }

  async #wake(event: ConnectEvent): Promise<DeliverOutcome> {
    const { context, connection } = event;
    const target = { resourceId: context.resourceId, threadId: context.threadId };
    if (
      event.projectId !== this.#host.projectId ||
      ![...this.#host.integrations, ...this.#host.channels].includes(context.integration)
    ) {
      return 'rejected';
    }
    const storage = this.mastra?.getStorage();
    const notifications = await storage?.getStore('notifications');
    const memory = await storage?.getStore('memory');
    if (!notifications || !memory) {
      throw new Error('Connection requests need agent memory and a notifications storage domain.');
    }
    const thread = await memory.getThreadById({ threadId: context.threadId });
    if (thread?.resourceId !== context.resourceId) return 'rejected';
    const existing = await notifications.listNotifications({
      threadId: context.threadId,
      source: CONNECT_SIGNAL_SOURCE,
    });
    if (existing.some(record => record.dedupeKey === event.key && record.deliveredSignalId)) return 'duplicate';

    const agent = this.agent;
    if (!agent) throw new Error('The connect signal provider is not connected to an agent.');
    if (agent.getActiveThreadRunId(target)) return 'failed';
    await Promise.race([this.#host.refresh().catch(() => undefined), sleep(REFRESH_WAIT_MS)]);

    const outcome = event.type === 'connection.active' ? 'connected' : 'failed';
    const name = displayNameOf(this.#host, context.integration);
    const label = connection.accountLabel ?? undefined;
    const attributes: ConnectSignalAttributes = {
      source: CONNECT_SIGNAL_SOURCE,
      connectRequestId: context.requestId,
      connectionId: connection.id,
      integration: context.integration,
      outcome,
      ...(label ? { accountLabel: label } : {}),
    };
    const result = await agent.sendNotificationSignal(
      {
        source: CONNECT_SIGNAL_SOURCE,
        kind: event.type,
        priority: 'urgent',
        summary:
          outcome === 'connected'
            ? `${name} connected. Continue the task.`
            : `${name} could not be connected. Tell the user.`,
        dedupeKey: event.key,
        attributes,
      },
      {
        ...target,
        ifActive: { behavior: 'discard' },
        ifIdle: {
          behavior: 'wake',
          streamOptions: {
            tracingOptions: nestUnderRun(context.trace ?? {}, {
              metadata: {
                connectionId: connection.id,
                connectRequestId: context.requestId,
                integration: context.integration,
                outcome,
              },
            }),
          },
        },
      },
    );
    const accepted = await result.accepted?.catch(() => undefined);
    return accepted?.action === 'wake' || accepted?.action === 'deliver' ? 'delivered' : 'failed';
  }
}

function pollUntil(host: ConnectRequestHost, deadline: number, step: () => Promise<boolean>): Promise<void> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  host.disposers.add(stop);
  return runUntraced(async () => {
    while (!controller.signal.aborted && Date.now() < deadline) {
      if (await step().catch(() => false)) break;
      await sleep(POLL_INTERVAL_MS);
    }
    host.disposers.delete(stop);
  });
}

const retryable = (outcome: DeliverOutcome) => outcome === 'failed' || outcome === 'in_flight';

async function readCappedBody(request: Request): Promise<string | undefined> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_WEBHOOK_BYTES) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request.body ?? []) {
    size += chunk.byteLength;
    if (size > MAX_WEBHOOK_BYTES) return undefined;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const DONE_PAGE =
  '<!doctype html><meta charset="utf-8"><title>Connected</title><p>Connected. You can close this window.</p><script>window.close()</script>';

export function connectRoutes(secret: string | undefined): ApiRoute[] {
  return [
    registerApiRoute('/connect/webhook', {
      method: 'POST',
      requiresAuth: false,
      handler: async c => {
        const rawBody = await readCappedBody(c.req.raw);
        if (rawBody === undefined) return c.json({ error: 'payload_too_large' }, 413);
        if (!secret || !verifyConnectSignature(rawBody, c.req.header('x-mastra-signature'), secret)) {
          return c.json({ error: 'invalid_signature' }, 401);
        }
        let parsed: ReturnType<typeof connectEventSchema.safeParse>;
        try {
          parsed = connectEventSchema.safeParse(JSON.parse(rawBody));
        } catch {
          return c.json({ error: 'invalid_payload' }, 400);
        }
        if (!parsed.success) return c.json({ error: 'invalid_payload' }, 400);
        const provider = connectProviders.get(parsed.data.context.agentId);
        if (!provider) return c.json({ error: 'unknown_agent' }, 404);
        const outcome = await provider.deliver(parsed.data);
        return c.json({ outcome }, OUTCOME_STATUS[outcome]);
      },
    }),
    registerApiRoute(CONNECT_DONE_PATH, {
      method: 'GET',
      requiresAuth: false,
      handler: async c => c.html(DONE_PAGE),
    }),
  ];
}

export function buildConnectIntegrationTool(host: ConnectRequestHost, connections: ProjectConnection[]) {
  const integrationOffers = host.integrations.flatMap(id => {
    const own = connections.filter(connection => connection.integrationId === id);
    if (own.some(connection => connection.status === 'active')) return [];
    const needsReauth = own.some(connection => connection.status === 'needs_reauth');
    return [{ id, line: `- ${id}: ${displayNameOf(host, id)}${needsReauth ? ' (needs reconnecting)' : ''}` }];
  });
  const offers = [
    ...integrationOffers,
    ...host.channels.map(id => ({ id, line: `- ${id}: ${displayNameOf(host, id)} (channel)` })),
  ];
  const [first, ...rest] = offers.map(offer => offer.id);
  if (!first) return undefined;

  return createTool({
    id: CONNECT_INTEGRATION_TOOL,
    description: [
      'Ask the user to connect an integration that is not connected yet or needs reconnecting.',
      'Call it when a task needs one of these integrations, or when the user asks to connect one.',
      'The user sees a Connect card. End your turn after calling it; you are woken with the result.',
      'Integrations:',
      ...offers.map(offer => offer.line),
    ].join('\n'),
    inputSchema: z.object({
      integration: z.enum([first, ...rest]).describe('Integration id to connect.'),
      reason: z.string().describe('One sentence telling the user why the connection is needed.'),
    }),
    execute: async ({ integration, reason }, context) => {
      const agentId = context.agent?.agentId;
      const threadId = context.agent?.threadId;
      const resourceId = context.agent?.resourceId;
      const requestContext = context.requestContext ?? new RequestContext();
      if (!(await host.allow({ requestContext, agentId, threadId, resourceId }))) {
        return { status: 'error', message: 'Not allowed to request connections here.' };
      }
      if (!agentId || !threadId || !resourceId || !context.agent?.toolCallId) {
        return { status: 'error', message: 'Connection requests need agent memory (a thread and resource id).' };
      }
      if (!context.mastra || !(await context.mastra.getStorage()?.getStore('notifications'))) {
        return { status: 'error', message: 'Connection requests need a notifications storage domain.' };
      }
      const provider = connectProviders.get(agentId);
      if (!provider) {
        return {
          status: 'error',
          message: `Agent '${agentId}' has no connect signal provider: add signals: [connectTools.signalProvider()] to it.`,
        };
      }

      const requestId = context.agent.toolCallId;
      const span = context.tracingContext?.currentSpan;
      const trace = span?.traceId ? { traceId: span.traceId, spanId: span.id } : undefined;
      const callbackContext = { requestId, agentId, threadId, resourceId, integration, ...(trace ? { trace } : {}) };
      const logoUrl = host.catalog().find(entry => entry.id === integration)?.logoUrl;
      const writeRequest = async (target: Pick<ConnectRequestData, 'connectionId' | 'connectUrl' | 'expiresAt'>) => {
        span?.update({ metadata: { connectionId: target.connectionId, connectRequestId: requestId, integration } });
        const data: ConnectRequestData = {
          requestId,
          integration,
          displayName: displayNameOf(host, integration),
          ...(logoUrl ? { logoUrl } : {}),
          reason,
          ...target,
          agentId,
          threadId,
          resourceId,
          ...(trace ? { trace } : {}),
        };
        await context.writer?.custom({ type: CONNECT_REQUEST_PART, data });
        return { status: 'pending' };
      };

      const own = (await listProjectConnections(host.client, host.projectId)).filter(
        connection => connection.integrationId === integration,
      );
      if (own.some(connection => connection.status === 'active')) {
        if (host.channels.includes(integration)) {
          return requestChannelInstall(host, provider, context.mastra, callbackContext, writeRequest);
        }
        void host.refresh().catch(() => undefined);
        return { status: 'connected' };
      }

      const session = await createConnectSession(host.client, {
        projectId: host.projectId,
        integrationId: integration,
        reconnectConnectionId: own.find(connection => connection.status === 'needs_reauth')?.id,
        ...(host.webhookUrl ? { callback: { url: host.webhookUrl, context: callbackContext } } : {}),
      });
      const result = await writeRequest(session);
      if (!host.webhookUrl) pollForConnection(host, provider, session, callbackContext);
      return result;
    },
  });
}

async function requestChannelInstall(
  host: ConnectRequestHost,
  provider: ConnectSignalProvider,
  mastra: Pick<Mastra, 'resolveChannels' | 'getStorage'>,
  context: ConnectEvent['context'],
  writeRequest: (
    target: Pick<ConnectRequestData, 'connectionId' | 'connectUrl' | 'expiresAt'>,
  ) => Promise<{ status: string }>,
) {
  const { integration, agentId } = context;
  let channel = (await mastra.resolveChannels())[integration];
  if (!channel) {
    await Promise.allSettled([...channelRefreshers].map(refresh => refresh()));
    channel = (await mastra.resolveChannels())[integration];
  }
  if (!channel?.connect) {
    return {
      status: 'error',
      message: `The ${displayNameOf(host, integration)} channel is not set up on this server: pass channels() from @mastra/connect to Mastra.`,
    };
  }
  const installations = (await channel.listInstallations?.()) ?? [];
  if (installations.some(installation => installation.agentId === agentId && installation.status === 'active')) {
    return { status: 'connected' };
  }
  const result = await channel.connect(agentId, { redirectUrl: CONNECT_DONE_PATH });
  if (result.type === 'immediate') return { status: 'connected' };

  const expiresAt = Date.now() + CHANNEL_REQUEST_TTL_MS;
  const { installationId } = result;
  const key = pendingKey(installationId);
  const store = await pendingStore(host, mastra, true);
  const previous = pendingInstallSchema.safeParse((await store.getConfig(key))?.data).data?.requests ?? [];
  const requests = [...previous.filter(request => request.expiresAt > Date.now()), { context, expiresAt }];
  await store.saveConfig({ platform: key, data: { requests }, updatedAt: new Date() });
  const reconcile = channel.reconcileInstallation?.bind(channel);
  if (integration === 'discord' && reconcile && !host.reconciling.has(installationId)) {
    host.reconciling.add(installationId);
    void pollUntil(host, expiresAt, async () => {
      if (!(await store.getConfig(key))) return true;
      if ((await reconcile(agentId))?.status !== 'active') return false;
      await provider.completeInstall(integration, installationId);
      return true;
    }).finally(() => host.reconciling.delete(installationId));
  }
  return writeRequest({
    connectionId: installationId,
    connectUrl: result.type === 'oauth' ? result.authorizationUrl : result.url,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

function pollForConnection(
  host: ConnectRequestHost,
  provider: ConnectSignalProvider,
  session: { connectionId: string; expiresAt: string },
  context: ConnectEvent['context'],
): void {
  void pollUntil(host, Date.parse(session.expiresAt), async () => {
    const connection = (await listProjectConnections(host.client, host.projectId)).find(
      candidate => candidate.id === session.connectionId,
    );
    const outcome = connection?.status === 'active' ? 'active' : connection?.status === 'error' ? 'failed' : undefined;
    if (!connection || !outcome) return false;
    const delivered = await provider.deliver({
      key: `${connection.id}:${context.requestId}:${outcome}`,
      projectId: host.projectId,
      type: `connection.${outcome}`,
      connection,
      error: null,
      context,
    });
    return !retryable(delivered);
  });
}
