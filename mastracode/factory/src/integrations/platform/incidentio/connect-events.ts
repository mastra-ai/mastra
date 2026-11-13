import type { IssueReconcileOne } from '../../issue-reconciler.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';

const INCIDENT_PREFIX = 'incidentio:incident:';
const FOLLOW_UP_PREFIX = 'incidentio:follow-up:';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function id(value: unknown): string | null {
  const id = record(value)?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * The card external id an incident.io webhook names. incident.io puts the
 * resource under a key named after the event type (`body[body.event_type]`).
 * Incident events name an incident; follow-up and (older) action events name
 * a follow-up. Nothing else is read from the payload.
 */
export function incidentioItemFromPayload(payload: unknown): string | null {
  const body = record(payload);
  const eventType = body?.event_type;
  if (typeof eventType !== 'string') return null;
  const resource = record(body?.[eventType]);
  if (!resource) return null;
  if (/\.incident_[a-z_]+_v\d+$/.test(eventType)) {
    const incidentId = id(resource.incident) ?? id(resource);
    return incidentId ? `${INCIDENT_PREFIX}${incidentId}` : null;
  }
  if (/\.(follow_up|action)_[a-z_]+_v\d+$/.test(eventType)) {
    const followUpId = id(resource.follow_up) ?? id(resource);
    return followUpId ? `${FOLLOW_UP_PREFIX}${followUpId}` : null;
  }
  return null;
}

/**
 * Re-fetches the incident or follow-up an incident.io event names and
 * reconciles its cards. Item references carry no connection id (incident.io
 * ids are globally unique), so the reconcile resolves the owning connection
 * the same way a sweep does. An unverified event can at most cause a
 * re-fetch of an item Factory already tracks.
 */
export async function handleIncidentioConnectEvent(
  event: PlatformConnectEventDelivery,
  reconcileOne: IssueReconcileOne | null,
): Promise<void> {
  const itemRef = incidentioItemFromPayload(event.payload);
  if (!itemRef || !reconcileOne) return;
  const summary = await reconcileOne(externalId => externalId === itemRef);
  if (summary.failed > 0) {
    throw new Error(`incident.io ${itemRef} could not be reconciled: ${summary.errors[0]?.error ?? 'unknown error'}`);
  }
}
