import type { FactoryDispatchFailureCode } from '@mastra/factory/storage/domains/work-items/base';

/** `dismissed` is human rejection; `superseded` means newer Factory state made a proposal obsolete. */
export type FactoryDecisionStatus =
  | 'pending'
  | 'proposed'
  | 'dismissed'
  | 'superseded'
  | 'leased'
  | 'retry'
  | 'succeeded'
  | 'failed';

/** What a person can do to a queued effect from the board or the Rules page. */
export type FactoryDecisionAction = 'approve' | 'dismiss' | 'retry';

export interface FactoryDecisionSummary {
  id: string;
  evaluationId: string;
  workItemId: string | null;
  type: string;
  /** Session slot a proposed run fills, so the card can name what it starts. */
  role: string | null;
  /** Where a linked card is synced from; `null` for effects that are not `upsertLinkedWorkItem`. */
  source: 'github-issue' | 'github-pr' | 'linear-issue' | 'manual' | null;
  status: FactoryDecisionStatus;
  attempts: number;
  failureOccurrence: number;
  failureCode: FactoryDispatchFailureCode | null;
  canRetry: boolean;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface FactoryDecisionPage {
  decisions: FactoryDecisionSummary[];
  nextCursor?: string;
}

async function throwRequestError(response: Response): Promise<never> {
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    message = body.message ?? body.error ?? message;
  } catch {
    // Keep the status-based fallback for non-JSON responses.
  }
  throw new Error(message);
}

export async function fetchFactoryDecisions(
  baseUrl: string,
  githubProjectId: string,
  options: { statuses?: FactoryDecisionStatus[]; before?: string; limit?: number } = {},
): Promise<FactoryDecisionPage> {
  const query = new URLSearchParams();
  if (options.statuses?.length) query.set('statuses', options.statuses.join(','));
  if (options.before) query.set('before', options.before);
  if (options.limit) query.set('limit', String(options.limit));
  const suffix = query.size > 0 ? `?${query}` : '';
  const response = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(githubProjectId)}/decisions${suffix}`,
    { headers: { Accept: 'application/json' }, credentials: 'include' },
  );
  if (!response.ok) return throwRequestError(response);
  return (await response.json()) as FactoryDecisionPage;
}

export async function actOnFactoryDecision(
  baseUrl: string,
  githubProjectId: string,
  decisionId: string,
  action: FactoryDecisionAction,
): Promise<{ decision: FactoryDecisionSummary }> {
  const response = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(githubProjectId)}/decisions/${encodeURIComponent(decisionId)}/${action}`,
    { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'include' },
  );
  if (!response.ok) return throwRequestError(response);
  return (await response.json()) as { decision: FactoryDecisionSummary };
}
