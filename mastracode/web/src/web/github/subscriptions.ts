import type {
  GithubSignalSubscriptionRow,
  GithubSignalSubscriptionStatus,
  GithubStorage,
  GithubWebhookPullRequestTarget,
  PullRequestSubscriptionTarget,
  SubscribeToPullRequestInput,
  ThreadSubscriptionTarget,
} from './storage/base';

export type {
  GithubSignalSubscriptionStatus,
  GithubWebhookPullRequestTarget,
  PullRequestSubscriptionTarget,
  SubscribeToPullRequestInput,
  ThreadSubscriptionTarget,
} from './storage/base';

export function subscribeToPullRequest(
  input: SubscribeToPullRequestInput,
  storage: GithubStorage,
): Promise<GithubSignalSubscriptionRow> {
  return storage.subscribeToPullRequest(input);
}

export function unsubscribeFromPullRequest(input: SubscribeToPullRequestInput, storage: GithubStorage): Promise<void> {
  return storage.unsubscribeFromPullRequest(input);
}

export function listPullRequestSubscriptionsForThread(
  input: ThreadSubscriptionTarget,
  storage: GithubStorage,
): Promise<GithubSignalSubscriptionRow[]> {
  return storage.listPullRequestSubscriptionsForThread(input);
}

export function listPullRequestSubscriptions(
  input: PullRequestSubscriptionTarget,
  storage: GithubStorage,
): Promise<GithubSignalSubscriptionRow[]> {
  return storage.listPullRequestSubscriptions(input);
}

export function listPullRequestSubscriptionsForWebhook(
  input: GithubWebhookPullRequestTarget,
  options: { includeTerminal?: boolean } | undefined,
  storage: GithubStorage,
): Promise<GithubSignalSubscriptionRow[]> {
  return storage.listPullRequestSubscriptionsForWebhook(input, options);
}

export function retirePullRequestSubscription(
  id: string,
  status: GithubSignalSubscriptionStatus,
  storage: GithubStorage,
): Promise<void> {
  return storage.retirePullRequestSubscription(id, status);
}

export function retirePullRequestSubscriptions(
  input: PullRequestSubscriptionTarget,
  storage: GithubStorage,
): Promise<void> {
  return storage.retirePullRequestSubscriptions(input);
}
