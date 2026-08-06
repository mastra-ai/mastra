import type { IntegrationStorageHandle, IntegrationSubscription } from '../../storage/domains/integrations/base.js';

export type GithubSignalSubscriptionSource =
  'auto-gh-pr-create' | 'factory-pr-create' | 'factory-review-binding' | 'explicit-tool';
export type GithubSignalSubscriptionStatus = 'open' | 'closed' | 'merged';

export interface GithubSignalSubscriptionData {
  installationExternalId: string;
  projectRepositoryId: string;
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
  projectRepositoryId: string;
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
export type GithubRepositoryTarget = Omit<GithubWebhookPullRequestTarget, 'changeRequestId'>;

function changeRequestTargetPrefix(input: GithubRepositoryTarget): string {
  return `change-request:${input.installationExternalId}:${input.repositoryExternalId}:`;
}

export function changeRequestTargetKey(input: GithubWebhookPullRequestTarget): string {
  return `${changeRequestTargetPrefix(input)}${input.changeRequestId}`;
}

/**
 * Pull requests one repository still has an open subscription for.
 *
 * The reconcile sweep is otherwise card-driven, and a review card reaches
 * `done` the moment the review pass ends — usually well before a human merges
 * the pull request. Sweeping the cards alone would leave those subscriptions
 * open forever whenever the merge webhook is missed.
 */
export async function listSubscribedPullRequestNumbers(
  repository: GithubRepositoryTarget,
  // Only the target keys are read, so both the typed and the generic handle fit.
  storage: { subscriptions: { listByStatus(status: string): Promise<{ targetKey: string }[]> } },
): Promise<number[]> {
  const prefix = changeRequestTargetPrefix(repository);
  const rows = await storage.subscriptions.listByStatus('open');
  const numbers = new Set<number>();
  for (const row of rows) {
    if (!row.targetKey.startsWith(prefix)) continue;
    const pullRequestNumber = Number(row.targetKey.slice(prefix.length));
    if (Number.isInteger(pullRequestNumber) && pullRequestNumber > 0) numbers.add(pullRequestNumber);
  }
  return [...numbers];
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
      projectRepositoryId: input.projectRepositoryId,
      repositoryExternalId: input.repositoryExternalId,
      repositorySlug: input.repositorySlug,
      changeRequestId: input.changeRequestId,
      ownerId: input.ownerId,
      source: input.source,
      subscribedByUserId: input.subscribedByUserId ?? null,
    },
  });
}

/**
 * Re-create a subscription a session lost, without reviving a retired one.
 *
 * `subscribeToPullRequest` reopens whatever row it finds. A reconcile-time
 * backfill doing that would fight the retire the same sweep just performed,
 * every sweep. Returns whether a row was created.
 */
export async function restorePullRequestSubscription(
  input: SubscribeToPullRequestInput,
  // Same rows as the typed handle — the sweep only ever holds the generic one.
  storage: IntegrationStorageHandle,
): Promise<boolean> {
  const github = storage as unknown as GithubSubscriptionStorage;
  const rows = await github.subscriptions.listByTarget(changeRequestTargetKey(input));
  if (rows.some(row => sameSession(row, input))) return false;
  await subscribeToPullRequest(input, github);
  return true;
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
