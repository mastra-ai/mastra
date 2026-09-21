import type { IntegrationStorageHandle, IntegrationSubscription } from '../../storage/domains/integrations/base.js';

export type GitLabSignalSubscriptionSource = 'auto-create-change-request' | 'explicit-tool';
export type GitLabSignalSubscriptionStatus = 'open' | 'closed' | 'merged';

export interface GitLabSignalSubscriptionData {
  /** Normalized GitLab instance host. */
  host: string;
  /** Immutable numeric GitLab project id, as stored on the repository row. */
  projectId: string;
  /** Project `path_with_namespace`, used for links and summaries. */
  projectPath: string;
  projectRepositoryId: string;
  /** The stored connection id of the installation the link was created under. */
  installationExternalId: string;
  /** Merge request IID. */
  changeRequestId: string;
  ownerId: string;
  source: GitLabSignalSubscriptionSource;
  subscribedByUserId: string | null;
}

export type GitLabSignalSubscriptionRow = IntegrationSubscription<GitLabSignalSubscriptionData>;
export type GitLabSubscriptionStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  Record<string, unknown>,
  GitLabSignalSubscriptionData
>;

export interface SubscribeToMergeRequestInput {
  orgId: string;
  host: string;
  projectId: string;
  projectPath: string;
  projectRepositoryId: string;
  installationExternalId: string;
  changeRequestId: string;
  sessionId: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
  source: GitLabSignalSubscriptionSource;
  subscribedByUserId?: string;
}

export interface GitLabThreadSubscriptionTarget {
  orgId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
}

export interface MergeRequestSubscriptionTarget {
  orgId: string;
  host: string;
  projectId: string;
  changeRequestId: string;
}

export type GitLabWebhookMergeRequestTarget = Omit<MergeRequestSubscriptionTarget, 'orgId'>;

export function normalizeSubscriptionHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

export function mergeRequestTargetKey(input: GitLabWebhookMergeRequestTarget): string {
  return `change-request:gitlab:${normalizeSubscriptionHost(input.host)}:${input.projectId}:${input.changeRequestId}`;
}

export function mergeRequestUrl(host: string, projectPath: string, changeRequestId: string | number): string {
  return `https://${normalizeSubscriptionHost(host)}/${projectPath.replace(/^\/+|\/+$/g, '')}/-/merge_requests/${changeRequestId}`;
}

function sameSession(row: GitLabSignalSubscriptionRow, input: SubscribeToMergeRequestInput): boolean {
  return (
    row.orgId === input.orgId &&
    row.sessionId === input.sessionId &&
    row.resourceId === input.resourceId &&
    row.threadId === input.threadId &&
    (row.sessionScope ?? '') === (input.sessionScope ?? '')
  );
}

export async function subscribeToMergeRequest(
  input: SubscribeToMergeRequestInput,
  storage: GitLabSubscriptionStorage,
): Promise<GitLabSignalSubscriptionRow> {
  const targetKey = mergeRequestTargetKey(input);
  const existing = (await storage.subscriptions.listByTarget(targetKey)).find(row => sameSession(row, input));
  if (existing) {
    if (existing.status !== 'open') await storage.subscriptions.updateStatus(existing.id, 'open');
    return { ...existing, status: 'open' };
  }

  return storage.subscriptions.create({
    orgId: input.orgId,
    targetKey,
    sessionId: input.sessionId,
    resourceId: input.resourceId,
    threadId: input.threadId,
    sessionScope: input.sessionScope ?? '',
    status: 'open',
    data: {
      host: normalizeSubscriptionHost(input.host),
      projectId: input.projectId,
      projectPath: input.projectPath,
      projectRepositoryId: input.projectRepositoryId,
      installationExternalId: input.installationExternalId,
      changeRequestId: input.changeRequestId,
      ownerId: input.ownerId,
      source: input.source,
      subscribedByUserId: input.subscribedByUserId ?? null,
    },
  });
}

export async function unsubscribeFromMergeRequest(
  input: SubscribeToMergeRequestInput,
  storage: GitLabSubscriptionStorage,
): Promise<void> {
  const rows = await storage.subscriptions.listByTarget(mergeRequestTargetKey(input));
  await Promise.all(rows.filter(row => sameSession(row, input)).map(row => storage.subscriptions.delete(row.id)));
}

export async function listMergeRequestSubscriptionsForThread(
  input: GitLabThreadSubscriptionTarget,
  storage: GitLabSubscriptionStorage,
): Promise<GitLabSignalSubscriptionRow[]> {
  const rows = await storage.subscriptions.listByThread(input.resourceId, input.threadId);
  return rows.filter(
    row =>
      row.orgId === input.orgId &&
      row.resourceId === input.resourceId &&
      row.threadId === input.threadId &&
      (row.sessionScope ?? '') === (input.sessionScope ?? ''),
  );
}

export async function listMergeRequestSubscriptions(
  input: MergeRequestSubscriptionTarget,
  storage: GitLabSubscriptionStorage,
): Promise<GitLabSignalSubscriptionRow[]> {
  const rows = await storage.subscriptions.listByTarget(mergeRequestTargetKey(input));
  return rows.filter(row => row.orgId === input.orgId && row.status === 'open');
}

export async function listMergeRequestSubscriptionsForWebhook(
  input: GitLabWebhookMergeRequestTarget,
  options: { includeTerminal?: boolean } | undefined,
  storage: GitLabSubscriptionStorage,
): Promise<GitLabSignalSubscriptionRow[]> {
  const rows = await storage.subscriptions.listByTarget(mergeRequestTargetKey(input));
  return options?.includeTerminal ? rows : rows.filter(row => row.status === 'open');
}

export function retireMergeRequestSubscription(
  id: string,
  status: GitLabSignalSubscriptionStatus,
  storage: GitLabSubscriptionStorage,
): Promise<void> {
  return storage.subscriptions.updateStatus(id, status);
}

/**
 * Retire every open subscription for a merge request that reached a terminal
 * state outside the webhook path (the reconcile sweep), so the thread's MR chip
 * and the workspace row do not stay `open` on a deployment GitLab cannot reach.
 */
export async function retireMergeRequestSubscriptions(
  input: GitLabWebhookMergeRequestTarget & { merged: boolean },
  storage: GitLabSubscriptionStorage,
): Promise<void> {
  const rows = await storage.subscriptions.listByTarget(mergeRequestTargetKey(input));
  await Promise.all(
    rows
      .filter(row => row.status === 'open')
      .map(row => storage.subscriptions.updateStatus(row.id, input.merged ? 'merged' : 'closed')),
  );
}
