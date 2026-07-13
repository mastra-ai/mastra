import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { getGithubWebhookSecret } from './config';

export interface GithubWebhookTriageRunInput {
  repository: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  labels: string[];
  sender?: string;
  installationId: number;
}

export interface GithubWebhookHandlerOptions {
  startIssueTriageRun?: (input: GithubWebhookTriageRunInput) => Promise<void>;
}

const SUPPORTED_GITHUB_WEBHOOK_EVENTS = new Set([
  'issues',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
]);

export interface GithubWebhookMetadata {
  event: string;
  action?: string;
  deliveryId: string;
  repository?: string;
  issueNumber?: number;
  pullRequestNumber?: number;
  sender?: string;
  installationId?: number;
}

export interface ParsedGithubWebhook {
  event: string;
  deliveryId: string;
  payload: Record<string, unknown>;
}

export type GithubWebhookResult =
  | { status: 202; body: { ok: true; ignored?: true } }
  | { status: 400; body: { error: 'bad_request'; message: string } }
  | { status: 401; body: { error: 'unauthorized'; message: string } };

function normalizeHeader(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) return false;
  const signatureHex = signature.slice('sha256='.length);
  if (!/^[a-fA-F0-9]{64}$/.test(signatureHex)) return false;

  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = Buffer.from(signatureHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function parseGithubWebhook(c: Context): Promise<ParsedGithubWebhook | GithubWebhookResult> {
  const secret = getGithubWebhookSecret();
  if (!secret) {
    return { status: 401, body: { error: 'unauthorized', message: 'GitHub webhook secret is not configured' } };
  }

  const event = normalizeHeader(c.req.header('x-github-event'));
  const deliveryId = normalizeHeader(c.req.header('x-github-delivery'));
  const signature = normalizeHeader(c.req.header('x-hub-signature-256'));

  if (!event) return { status: 400, body: { error: 'bad_request', message: 'Missing x-github-event header' } };
  if (!deliveryId) return { status: 400, body: { error: 'bad_request', message: 'Missing x-github-delivery header' } };
  if (!signature)
    return { status: 401, body: { error: 'unauthorized', message: 'Missing x-hub-signature-256 header' } };

  const rawBody = await c.req.text();
  if (!verifySignature(rawBody, signature, secret)) {
    return { status: 401, body: { error: 'unauthorized', message: 'Invalid GitHub webhook signature' } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'bad_request', message: 'Malformed JSON payload' } };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 400, body: { error: 'bad_request', message: 'Payload must be a JSON object' } };
  }

  return { event, deliveryId, payload: payload as Record<string, unknown> };
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

function getLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(label => (typeof label === 'string' ? label : getString(getObject(label)?.name)))
    .filter((label): label is string => Boolean(label));
}

function getIssueTriageRunInput(parsed: ParsedGithubWebhook): GithubWebhookTriageRunInput | null {
  if (parsed.event !== 'issues' || getString(parsed.payload.action) !== 'opened') return null;
  const repository = getString(getObject(parsed.payload.repository)?.full_name);
  const issue = getObject(parsed.payload.issue);
  const sender = getString(getObject(parsed.payload.sender)?.login);
  const installationId = getNumber(getObject(parsed.payload.installation)?.id);
  const issueNumber = getNumber(issue?.number);
  const issueTitle = getString(issue?.title);
  const issueUrl = getString(issue?.html_url);
  if (!repository || !installationId || !issueNumber || !issueTitle || !issueUrl) return null;
  return {
    repository,
    issueNumber,
    issueTitle,
    issueUrl,
    labels: getLabels(issue?.labels),
    sender,
    installationId,
  };
}

export function normalizeGithubWebhookMetadata(parsed: ParsedGithubWebhook): GithubWebhookMetadata {
  const { event, deliveryId, payload } = parsed;
  const repository = getObject(payload.repository);
  const issue = getObject(payload.issue);
  const pullRequest = getObject(payload.pull_request);
  const sender = getObject(payload.sender);
  const installation = getObject(payload.installation);

  return {
    event,
    action: getString(payload.action),
    deliveryId,
    repository: getString(repository?.full_name),
    issueNumber: getNumber(issue?.number),
    pullRequestNumber: getNumber(pullRequest?.number),
    sender: getString(sender?.login),
    installationId: getNumber(installation?.id),
  };
}

export async function handleGithubWebhook(
  c: Context,
  options: GithubWebhookHandlerOptions = {},
): Promise<GithubWebhookResult> {
  const parsed = await parseGithubWebhook(c);
  if ('status' in parsed) return parsed;

  if (!SUPPORTED_GITHUB_WEBHOOK_EVENTS.has(parsed.event)) {
    return { status: 202, body: { ok: true, ignored: true } };
  }

  const metadata = normalizeGithubWebhookMetadata(parsed);
  console.log('[GitHub Webhook]', metadata);

  const issueTriageRun = getIssueTriageRunInput(parsed);
  if (issueTriageRun && options.startIssueTriageRun) {
    try {
      await options.startIssueTriageRun(issueTriageRun);
    } catch (error) {
      console.error('[GitHub Webhook] Failed to start issue triage run', {
        deliveryId: metadata.deliveryId,
        repository: metadata.repository,
        issueNumber: metadata.issueNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { status: 202, body: { ok: true } };
}
