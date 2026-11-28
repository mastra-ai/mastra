/** Which source-control provider serves the subscriptions route. */
export type ChangeRequestProvider = 'github' | 'gitlab';

/** A pull or merge request a session thread follows. */
export interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  status: 'open' | 'closed' | 'merged';
  /** Absent on older servers. */
  updatedAt?: string;
  url: string;
}
