import type {
  FactoryDecisionAction,
  FactoryDecisionPage,
  FactoryDecisionStatus,
  FactoryDecisionSummary,
  RunQueueResponse,
} from '@internal/factory-contract';

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

/** The project's automated runs waiting for a run slot, oldest first, and the runs holding one. */
export async function fetchRunQueue(baseUrl: string, githubProjectId: string): Promise<RunQueueResponse> {
  const response = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(githubProjectId)}/run-queue`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) return throwRequestError(response);
  return (await response.json()) as RunQueueResponse;
}
