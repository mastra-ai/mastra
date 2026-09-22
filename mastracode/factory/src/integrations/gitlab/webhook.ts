import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';

import { dispatchGitLabWebhook } from './webhook-dispatch.js';
import type { GitLabWebhookDispatchDependencies } from './webhook-dispatch.js';

export const SUPPORTED_GITLAB_WEBHOOK_EVENTS = new Set(['Issue Hook', 'Note Hook', 'Merge Request Hook', 'Push Hook']);

export interface ParsedGitLabWebhook {
  event: string;
  deliveryId: string;
  instanceHost?: string;
  payload: Record<string, unknown>;
}

export interface GitLabWebhookMetadata {
  event: string;
  projectId?: number;
  projectPath?: string;
  issueIid?: number;
  mergeRequestIid?: number;
  noteableType?: string;
  sender?: string;
}

export type GitLabWebhookResult =
  | { status: 202; body: { ok: true; ignored?: true } }
  | { status: 400; body: { error: 'bad_request'; message: string } }
  | { status: 401; body: { error: 'unauthorized'; message: string } };

/**
 * What processing an already-parsed delivery needs: the rules ingress and,
 * when a controller is mounted, the subscription dispatch. Shared by the
 * direct webhook route and the Platform event poller.
 */
export interface GitLabWebhookProcessOptions extends Partial<Omit<GitLabWebhookDispatchDependencies, 'controller'>> {
  ingestFactoryEvent?: (event: ParsedGitLabWebhook) => Promise<unknown>;
  /** When present, merge-request activity is also delivered to subscribed sessions. */
  controller?: GitLabWebhookDispatchDependencies['controller'];
}

export interface GitLabWebhookHandlerOptions extends GitLabWebhookProcessOptions {
  webhookSecret?: string;
}

/**
 * `object_kind` values GitLab puts in every webhook body, mapped to the
 * `X-Gitlab-Event` header the direct route keys on. A body reaching Factory
 * without its headers (the Platform event log stores only the payload) is
 * normalized through this table so both ingress paths see the same event name.
 */
const GITLAB_OBJECT_KIND_EVENTS: Record<string, string> = {
  issue: 'Issue Hook',
  note: 'Note Hook',
  merge_request: 'Merge Request Hook',
  push: 'Push Hook',
};

function normalizeHeader(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeInstanceHost(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value.includes('://') ? value : 'https://' + value).host.toLowerCase();
  } catch {
    return undefined;
  }
}

export function verifyGitLabToken(receivedToken: string, secret: string): boolean {
  const received = Buffer.from(receivedToken, 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function parseGitLabWebhook(
  c: Context,
  secret: string | undefined,
): Promise<ParsedGitLabWebhook | GitLabWebhookResult> {
  if (!secret) {
    return { status: 401, body: { error: 'unauthorized', message: 'GitLab webhook secret is not configured' } };
  }

  const event = normalizeHeader(c.req.header('x-gitlab-event'));
  const token = normalizeHeader(c.req.header('x-gitlab-token'));
  if (!event) return { status: 400, body: { error: 'bad_request', message: 'Missing x-gitlab-event header' } };
  if (!token) return { status: 401, body: { error: 'unauthorized', message: 'Missing x-gitlab-token header' } };
  if (!verifyGitLabToken(token, secret)) {
    return { status: 401, body: { error: 'unauthorized', message: 'Invalid GitLab webhook token' } };
  }

  const rawBody = await c.req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'bad_request', message: 'Malformed JSON payload' } };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 400, body: { error: 'bad_request', message: 'Payload must be a JSON object' } };
  }
  const deliveryId =
    normalizeHeader(c.req.header('webhook-id')) ??
    normalizeHeader(c.req.header('idempotency-key')) ??
    normalizeHeader(c.req.header('x-gitlab-webhook-uuid')) ??
    normalizeHeader(c.req.header('x-gitlab-event-uuid')) ??
    createHash('sha256').update(event).update('\0').update(rawBody).digest('hex');
  const instanceHost = normalizeInstanceHost(c.req.header('x-gitlab-instance'));
  return {
    event,
    deliveryId,
    ...(instanceHost ? { instanceHost } : {}),
    payload: payload as Record<string, unknown>,
  };
}

function getObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeGitLabWebhookMetadata(parsed: ParsedGitLabWebhook): GitLabWebhookMetadata {
  const project = getObject(parsed.payload.project);
  const attributes = getObject(parsed.payload.object_attributes);
  const issue = getObject(parsed.payload.issue);
  const mergeRequest = getObject(parsed.payload.merge_request);
  const user = getObject(parsed.payload.user);
  const objectIid = getNumber(attributes?.iid);
  const noteableType = getString(attributes?.noteable_type);
  return {
    event: parsed.event,
    projectId: getNumber(project?.id),
    projectPath: getString(project?.path_with_namespace),
    issueIid:
      parsed.event === 'Issue Hook'
        ? objectIid
        : noteableType === 'Issue'
          ? (getNumber(issue?.iid) ?? objectIid)
          : undefined,
    mergeRequestIid:
      parsed.event === 'Merge Request Hook'
        ? objectIid
        : noteableType === 'MergeRequest'
          ? (getNumber(mergeRequest?.iid) ?? objectIid)
          : undefined,
    noteableType,
    sender: getString(parsed.payload.user_username) ?? getString(user?.username) ?? getString(user?.name),
  };
}

/**
 * Build the parsed form of a GitLab webhook from its raw body alone, for
 * deliveries that arrive without HTTP headers. The event name comes from
 * `object_kind`; the caller supplies a delivery id that is stable across
 * replays so rules replay handling and session dedupe keys behave as they do
 * for a direct delivery. Returns null when the body is not a webhook object or
 * its kind is one Factory does not handle, which callers treat exactly like an
 * unsupported event header: acknowledged and dropped.
 */
export function parseGitLabWebhookBody(body: unknown, deliveryId: string): ParsedGitLabWebhook | null {
  const payload = getObject(body);
  const objectKind = getString(payload?.object_kind);
  const id = normalizeHeader(deliveryId);
  if (!payload || !objectKind || !id) return null;
  const event = GITLAB_OBJECT_KIND_EVENTS[objectKind];
  if (!event) return null;
  return { event, deliveryId: id, payload };
}

/**
 * Process a parsed delivery: rules ingress first, then session dispatch when a
 * controller is mounted. Ingestion failures propagate so the caller can retry
 * the delivery (GitLab redelivers on a non-2xx; the poller leaves its cursor
 * in place).
 */
export async function processGitLabWebhook(
  parsed: ParsedGitLabWebhook,
  options: GitLabWebhookProcessOptions,
): Promise<GitLabWebhookResult> {
  if (!SUPPORTED_GITLAB_WEBHOOK_EVENTS.has(parsed.event)) {
    return { status: 202, body: { ok: true, ignored: true } };
  }

  console.info('[GitLab Webhook]', normalizeGitLabWebhookMetadata(parsed), { deliveryId: parsed.deliveryId });
  if (options.ingestFactoryEvent) await options.ingestFactoryEvent(parsed);
  if (!options.controller) return { status: 202, body: { ok: true } };

  const { ingestFactoryEvent: _ingest, controller, ...dispatch } = options;
  const result = await dispatchGitLabWebhook(parsed, {
    onSenderRejected: notification => {
      console.info('[GitLab Webhook] sender not authorized', {
        deliveryId: parsed.deliveryId,
        repository: notification.metadata.projectPath,
        sender: notification.metadata.sender,
        kind: notification.kind,
      });
    },
    ...dispatch,
    controller,
  });
  if (result.failed > 0) {
    console.warn(`[GitLab Webhook] ${result.failed} subscribed target(s) failed for delivery ${parsed.deliveryId}.`);
  }
  if (!result.ignored) console.info('[GitLab Webhook] session delivery', { deliveryId: parsed.deliveryId, ...result });
  // The rules ingress already acknowledged the event; an event no session
  // subscribes to is still a handled delivery, not an ignored one.
  return { status: 202, body: { ok: true } };
}

export async function handleGitLabWebhook(
  c: Context,
  options: GitLabWebhookHandlerOptions,
): Promise<GitLabWebhookResult> {
  const parsed = await parseGitLabWebhook(c, options.webhookSecret);
  if ('status' in parsed) return parsed;
  const { webhookSecret: _secret, ...process } = options;
  return processGitLabWebhook(parsed, process);
}
