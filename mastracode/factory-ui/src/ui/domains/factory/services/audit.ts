export interface AuditTarget {
  type: string;
  id: string;
  name?: string;
}

export interface AuditActorProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorType: 'human' | 'agent';
  action: string;
  targets: AuditTarget[];
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface AuditEventPage {
  events: AuditEvent[];
  actors: Record<string, AuditActorProfile>;
  nextCursor?: string;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isAuditTarget(value: unknown): value is AuditTarget {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'type' in value &&
    typeof value.type === 'string' &&
    'id' in value &&
    typeof value.id === 'string' &&
    (!('name' in value) || isOptionalString(value.name))
  );
}

function isAuditActorProfile(value: unknown): value is AuditActorProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    (!('avatarUrl' in value) || isOptionalString(value.avatarUrl))
  );
}

function isAuditEvent(value: unknown): value is AuditEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'actorId' in value &&
    typeof value.actorId === 'string' &&
    'actorType' in value &&
    (value.actorType === 'human' || value.actorType === 'agent') &&
    'action' in value &&
    typeof value.action === 'string' &&
    'targets' in value &&
    Array.isArray(value.targets) &&
    value.targets.every(isAuditTarget) &&
    'metadata' in value &&
    typeof value.metadata === 'object' &&
    value.metadata !== null &&
    !Array.isArray(value.metadata) &&
    'occurredAt' in value &&
    typeof value.occurredAt === 'string'
  );
}

function isAuditEventPage(value: unknown): value is AuditEventPage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'events' in value &&
    Array.isArray(value.events) &&
    value.events.every(isAuditEvent) &&
    'actors' in value &&
    typeof value.actors === 'object' &&
    value.actors !== null &&
    !Array.isArray(value.actors) &&
    Object.values(value.actors).every(isAuditActorProfile) &&
    (!('nextCursor' in value) || isOptionalString(value.nextCursor))
  );
}

async function throwRequestError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null) {
      if ('message' in body && typeof body.message === 'string') message = body.message;
      else if ('error' in body && typeof body.error === 'string') message = body.error;
    }
  } catch {}
  throw new Error(message);
}

export async function fetchAuditEvents(
  baseUrl: string,
  factoryProjectId: string,
  options: { actions?: string[]; actorIds?: string[]; before?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<AuditEventPage> {
  const query = new URLSearchParams();
  if (options.actions && options.actions.length > 0) query.set('actions', options.actions.join(','));
  if (options.actorIds && options.actorIds.length > 0) query.set('actorIds', options.actorIds.join(','));
  if (options.before) query.set('before', options.before);
  if (options.limit) query.set('limit', String(options.limit));
  const qs = query.size > 0 ? `?${query}` : '';
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/audit${qs}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal: options.signal,
  });
  if (!res.ok) return throwRequestError(res);

  const data: unknown = await res.json();
  if (!isAuditEventPage(data)) throw new Error('Invalid audit event response');
  return data;
}

export async function fetchAuditPortalLink(baseUrl: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/web/audit/portal-link`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (res.status === 404) return null;
  if (!res.ok) return throwRequestError(res);

  const data: unknown = await res.json();
  if (typeof data !== 'object' || data === null || !('url' in data) || typeof data.url !== 'string') {
    throw new Error('Invalid audit portal response');
  }
  return data.url;
}
