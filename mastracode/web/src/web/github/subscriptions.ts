import type { IntegrationStorageHandle, IntegrationSubscription } from '../storage/domains/integrations/base';

export type GithubSignalSubscriptionSource = 'auto-gh-pr-create' | 'factory-pr-create' | 'explicit-tool';
export type GithubSignalSubscriptionStatus = 'open' | 'closed' | 'merged';

export interface GithubSignalSubscriptionData {
  installationExternalId: string;
  projectId: string;
  repositoryExternalId: string;
  repositorySlug: string;
  changeRequestId: string;
  ownerId: string;
  source: GithubSignalSubscriptionSource;
  subscribedByUserId: string | null;
}

export type GithubSignalSubscriptionRow = IntegrationSubscription<GithubSignalSubscriptionData>;
export type GithubSubscriptionStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  Record<string, unknown>,
  GithubSignalSubscriptionData
>;

export interface SubscribeToPullRequestInput {
  orgId: string;
  installationExternalId: string;
  projectId: string;
  repositoryExternalId: string;
  repositorySlug: string;
  changeRequestId: string;
  sessionId: string;
  ownerId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
  source: GithubSignalSubscriptionSource;
  subscribedByUserId?: string;
}

export interface ThreadSubscriptionTarget {
  orgId: string;
  resourceId: string;
  threadId: string;
  sessionScope?: string;
}

export interface PullRequestSubscriptionTarget {
  orgId: string;
  installationExternalId: string;
  repositoryExternalId: string;
  changeRequestId: string;
}

export type GithubWebhookPullRequestTarget = Omit<PullRequestSubscriptionTarget, 'orgId'>;

export function changeRequestTargetKey(input: GithubWebhookPullRequestTarget): string {
  return `change-request:${input.installationExternalId}:${input.repositoryExternalId}:${input.changeRequestId}`;
}

function sameSession(row: GithubSignalSubscriptionRow, input: SubscribeToPullRequestInput): boolean {
  return (
    row.orgId === input.orgId &&
    row.sessionId === input.sessionId &&
    row.resourceId === input.resourceId &&
    row.threadId === input.threadId &&
    (row.sessionScope ?? '') === (input.sessionScope ?? '')
  );
}

export async function subscribeToPullRequest(
  input: SubscribeToPullRequestInput,
  storage: GithubSubscriptionStorage,
): Promise<GithubSignalSubscriptionRow> {
  const targetKey = changeRequestTargetKey(input);
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
      installationExternalId: input.installationExternalId,
      projectId: input.projectId,
      repositoryExternalId: input.repositoryExternalId,
      repositorySlug: input.repositorySlug,
      changeRequestId: input.changeRequestId,
      ownerId: input.ownerId,
      source: input.source,
      subscribedByUserId: input.subscribedByUserId ?? null,
    },
  });
}

export async function unsubscribeFromPullRequest(
  input: SubscribeToPullRequestInput,
  storage: GithubSubscriptionStorage,
): Promise<void> {
  const rows = await storage.subscriptions.listByTarget(changeRequestTargetKey(input));
  await Promise.all(rows.filter(row => sameSession(row, input)).map(row => storage.subscriptions.delete(row.id)));
}

export async function listPullRequestSubscriptionsForThread(
  input: ThreadSubscriptionTarget,
  storage: GithubSubscriptionStorage,
): Promise<GithubSignalSubscriptionRow[]> {
  const rows = await storage.subscriptions.listByThread(input.resourceId, input.threadId);
  return rows.filter(
    row =>
      row.orgId === input.orgId &&
      row.resourceId === input.resourceId &&
      row.threadId === input.threadId &&
      (row.sessionScope ?? '') === (input.sessionScope ?? ''),
  );
}

export async function listPullRequestSubscriptions(
  input: PullRequestSubscriptionTarget,
  storage: GithubSubscriptionStorage,
): Promise<GithubSignalSubscriptionRow[]> {
  const rows = await storage.subscriptions.listByTarget(changeRequestTargetKey(input));
  return rows.filter(row => row.orgId === input.orgId && row.status === 'open');
}

export async function listPullRequestSubscriptionsForWebhook(
  input: GithubWebhookPullRequestTarget,
  options: { includeTerminal?: boolean } | undefined,
  storage: GithubSubscriptionStorage,
): Promise<GithubSignalSubscriptionRow[]> {
  const rows = await storage.subscriptions.listByTarget(changeRequestTargetKey(input));
  return options?.includeTerminal ? rows : rows.filter(row => row.status === 'open');
}

export function retirePullRequestSubscription(
  id: string,
  status: GithubSignalSubscriptionStatus,
  storage: GithubSubscriptionStorage,
): Promise<void> {
  return storage.subscriptions.updateStatus(id, status);
}

export async function retirePullRequestSubscriptions(
  input: PullRequestSubscriptionTarget,
  storage: GithubSubscriptionStorage,
): Promise<void> {
  const rows = await listPullRequestSubscriptions(input, storage);
  await Promise.all(rows.map(row => storage.subscriptions.updateStatus(row.id, 'closed')));
}
