import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Agent } from '@mastra/core/agent';
import { nestUnderRun } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { registerApiRoute } from '@mastra/core/server';
import type { ApiRoute } from '@mastra/core/server';
import { WebhookSignalProvider } from '@mastra/core/signals';
import type { SignalProviderWebhookRequest } from '@mastra/core/signals';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationCatalogEntry, ProjectConnection, ResolvedClient } from './client.js';
import { createConnectSession, listProjectConnections } from './client.js';

export const CONNECT_REQUEST_PART = 'data-mastra-connect-request';
export const CONNECT_SIGNAL_SOURCE = 'mastra-connect';
export const CONNECT_REFRESH_KEY = 'mastra.connect.refresh';
export const CONNECT_INTEGRATION_TOOL = 'connect_integration';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const POLL_INTERVAL_MS = 2_000;

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
}

const connectEventSchema = z.object({
  key: z.string(),
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

export interface ConnectRequestHost {
  client: ResolvedClient;
  projectId: string;
  allow: RequestConnectionsOptions['allow'];
  webhookUrl: string | undefined;
  webhookSecret: string | undefined;
  offerable: string[];
  providers: Map<string, ConnectSignalProvider>;
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

export class ConnectSignalProvider extends WebhookSignalProvider {
  readonly #host: ConnectRequestHost;
  readonly #handled = new Set<string>();

  constructor(host: ConnectRequestHost) {
    super({ id: CONNECT_SIGNAL_SOURCE, name: 'Mastra Connect' });
    this.#host = host;
  }

  connect(agent: Agent<any, any, any, any>): void {
    super.connect(agent);
    this.#host.providers.set(agent.id, this);
  }

  async handleWebhook(request: SignalProviderWebhookRequest): Promise<{ status?: number; body?: unknown }> {
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const secret = this.#host.webhookSecret;
    if (!secret || !verifyConnectSignature(rawBody, request.headers['x-mastra-signature'], secret)) {
      return { status: 401, body: { error: 'invalid_signature' } };
    }
    const parsed = connectEventSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) return { status: 400, body: { error: 'invalid_payload' } };
    const delivered = await this.deliver(parsed.data);
    return { status: 200, body: { delivered } };
  }

  async deliver(event: ConnectEvent): Promise<boolean> {
    if (this.#handled.has(event.key)) return false;
    const { context, connection } = event;
    const notifications = await this.mastra?.getStorage()?.getStore('notifications');
    if (!notifications) {
      throw new Error('[@mastra/connect] Connection requests need a notifications storage domain.');
    }
    const existing = await notifications.listNotifications({
      threadId: context.threadId,
      source: CONNECT_SIGNAL_SOURCE,
    });
    if (existing.some(record => record.dedupeKey === event.key)) {
      this.#handled.add(event.key);
      return false;
    }

    await this.#host.refresh().catch((error: unknown) => {
      console.warn(
        `[@mastra/connect] Tool refresh after ${event.type} failed; the woken run refreshes again: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

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
    await this.notify(
      {
        source: CONNECT_SIGNAL_SOURCE,
        kind: event.type,
        priority: 'urgent',
        summary:
          outcome === 'connected'
            ? `${name} connected${label ? ` (${label})` : ''}. Continue the task.`
            : `${name} could not be connected${event.error?.code ? ` (${event.error.code})` : ''}. Tell the user.`,
        dedupeKey: event.key,
        attributes,
      },
      {
        threadId: context.threadId,
        resourceId: context.resourceId,
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
            requestContext: new RequestContext([[CONNECT_REFRESH_KEY, true]]),
          },
        },
      },
    );
    this.#handled.add(event.key);
    return true;
  }
}

export function connectWebhookRoute(providers: Map<string, ConnectSignalProvider>): ApiRoute {
  return registerApiRoute('/connect/webhook', {
    method: 'POST',
    requiresAuth: false,
    handler: async c => {
      const rawBody = await c.req.text();
      let agentId: unknown;
      try {
        agentId = (JSON.parse(rawBody) as { context?: { agentId?: unknown } }).context?.agentId;
      } catch {
        return c.json({ error: 'invalid_payload' }, 400);
      }
      const provider = typeof agentId === 'string' ? providers.get(agentId) : undefined;
      if (!provider) return c.json({ error: 'unknown_agent' }, 404);
      const result = await provider.handleWebhook({ body: rawBody, headers: c.req.header() });
      return c.json(result.body ?? {}, (result.status ?? 200) as 200);
    },
  });
}

export function buildConnectIntegrationTool(host: ConnectRequestHost, connections: ProjectConnection[]) {
  const offers = host.offerable.flatMap(id => {
    const own = connections.filter(connection => connection.integrationId === id);
    if (own.some(connection => connection.status === 'active')) return [];
    const needsReauth = own.some(connection => connection.status === 'needs_reauth');
    return [{ id, line: `- ${id}: ${displayNameOf(host, id)}${needsReauth ? ' (needs reconnecting)' : ''}` }];
  });
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
      if (!(await context.mastra?.getStorage()?.getStore('notifications'))) {
        return { status: 'error', message: 'Connection requests need a notifications storage domain.' };
      }
      const provider = host.providers.get(agentId);
      if (!provider) {
        return {
          status: 'error',
          message: `Agent '${agentId}' has no connect signal provider: add signals: [connectTools.signalProvider()] to it.`,
        };
      }

      const own = (await listProjectConnections(host.client, host.projectId)).filter(
        connection => connection.integrationId === integration,
      );
      if (own.some(connection => connection.status === 'active')) {
        void host.refresh().catch(() => undefined);
        return { status: 'connected' };
      }

      const requestId = context.agent.toolCallId;
      const span = context.tracingContext?.currentSpan;
      const trace = span?.traceId ? { traceId: span.traceId, spanId: span.id } : undefined;
      const callbackContext = { requestId, agentId, threadId, resourceId, integration, ...(trace ? { trace } : {}) };
      const session = await createConnectSession(host.client, {
        projectId: host.projectId,
        integrationId: integration,
        reconnectConnectionId: own.find(connection => connection.status === 'needs_reauth')?.id,
        ...(host.webhookUrl ? { callback: { url: host.webhookUrl, context: callbackContext } } : {}),
      });
      span?.update({ metadata: { connectionId: session.connectionId, connectRequestId: requestId, integration } });

      const logoUrl = host.catalog().find(entry => entry.id === integration)?.logoUrl;
      const data: ConnectRequestData = {
        requestId,
        integration,
        displayName: displayNameOf(host, integration),
        ...(logoUrl ? { logoUrl } : {}),
        reason,
        connectionId: session.connectionId,
        connectUrl: session.connectUrl,
        expiresAt: session.expiresAt,
        agentId,
        threadId,
        resourceId,
        ...(trace ? { trace } : {}),
      };
      await context.writer?.custom({ type: CONNECT_REQUEST_PART, data });
      if (!host.webhookUrl) void pollForOutcome(host, provider, session, callbackContext);
      return { status: 'pending' };
    },
  });
}

async function pollForOutcome(
  host: ConnectRequestHost,
  provider: ConnectSignalProvider,
  session: { connectionId: string; expiresAt: string },
  context: ConnectEvent['context'],
): Promise<void> {
  const deadline = Date.parse(session.expiresAt);
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    let connection: ProjectConnection | undefined;
    try {
      connection = (await listProjectConnections(host.client, host.projectId)).find(
        candidate => candidate.id === session.connectionId,
      );
    } catch {
      continue;
    }
    const outcome = connection?.status === 'active' ? 'active' : connection?.status === 'error' ? 'failed' : undefined;
    if (!connection || !outcome) continue;
    await provider
      .deliver({
        key: `${connection.id}:${context.requestId}:${outcome}`,
        type: `connection.${outcome}`,
        connection,
        error: null,
        context,
      })
      .catch((error: unknown) => {
        console.warn(
          `[@mastra/connect] Could not report the ${context.integration} connection result: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    return;
  }
}
