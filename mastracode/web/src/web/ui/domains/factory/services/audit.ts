/**
 * Browser-side helpers for the Factory audit-trail endpoints.
 *
 * Mirrors the server's audit read API (`src/web/audit/routes.ts`): an
 * org+project-scoped event list with keyset pagination, plus an optional
 * one-time WorkOS Admin Portal link for the enterprise audit-log viewer.
 */

export interface AuditTarget {
  type: string;
  id: string;
  name?: string;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  /** WorkOS user id of whoever performed the action, or `agent:<threadId>`. */
  actorId: string;
  /** Whether a human or an agent (inside a run) performed the action. */
  actorType: 'human' | 'agent';
  /** Dot-namespaced action, e.g. 'factory.work_item.stage_moved'. */
  action: string;
  targets: AuditTarget[];
  /** Bounded event summary — never full payloads. */
  metadata: Record<string, unknown>;
  githubProjectId: string | null;
  context: { location?: string; userAgent?: string };
  /** ISO timestamp. */
  occurredAt: string;
}

export interface AuditEventPage {
  events: AuditEvent[];
  /** Pass back as `before` to fetch the next (older) page; absent at the end. */
  nextCursor?: string;
}

async function throwRequestError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.message) message = body.message;
    else if (body.error) message = body.error;
  } catch {
    /* ignore non-JSON */
  }
  throw new Error(message);
}

/** Fetch one page of the Factory project's audit trail, newest-first. */
export async function fetchAuditEvents(
  baseUrl: string,
  factoryProjectId: string,
  options: { actions?: string[]; before?: string; limit?: number } = {},
): Promise<AuditEventPage> {
  const query = new URLSearchParams();
  if (options.actions && options.actions.length > 0) query.set('actions', options.actions.join(','));
  if (options.before) query.set('before', options.before);
  if (options.limit) query.set('limit', String(options.limit));
  const qs = query.size > 0 ? `?${query}` : '';
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/audit${qs}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) return throwRequestError(res);
  return (await res.json()) as AuditEventPage;
}

/**
 * Fetch a one-time WorkOS Admin Portal URL for the audit-log viewer, or
 * `null` when WorkOS isn't configured (the UI hides the button).
 */
export async function fetchAuditPortalLink(baseUrl: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/web/audit/portal-link`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) return throwRequestError(res);
  const data = (await res.json()) as { url: string };
  return data.url;
}
