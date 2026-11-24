import { createHash } from 'node:crypto';

import { AlertSchema, type Alert } from '../../schemas/alert.js';
import {
  AlertWebhookSchema,
  WorkOsMembershipObjectSchema,
  WorkOsRealEnvelopeSchema,
  WorkOsSessionObjectSchema,
} from './schemas.js';

export type NormalizationResult =
  | Readonly<{ disposition: 'alert'; alert: Alert }>
  | Readonly<{
      disposition: 'dead_letter';
      reasonCode: 'EVENT_UNKNOWN' | 'EVENT_VERSION_UNSUPPORTED' | 'WORKOS_ALLOWLIST_REJECTED';
      eventRef: string;
    }>;

export function normalizeAlertWebhook(
  value: unknown,
  rawBody: Uint8Array,
  allowedSources: ReadonlySet<string>,
): NormalizationResult {
  const input = AlertWebhookSchema.parse(value);
  if (!allowedSources.has(input.source)) {
    throw new Error('ALERT_SOURCE_UNSUPPORTED');
  }
  return {
    disposition: 'alert',
    alert: buildAlert(input, rawBody),
  };
}

export function normalizeWorkOsReal(
  value: unknown,
  rawBody: Uint8Array,
  allowlist: Readonly<{
    organizationId: string;
    userIds: ReadonlySet<string>;
    roleSlugs: ReadonlySet<string>;
  }>,
): NormalizationResult {
  const envelope = WorkOsRealEnvelopeSchema.parse(value);
  if (envelope.event === 'organization_membership.updated') {
    const data = WorkOsMembershipObjectSchema.parse(envelope.data);
    if (
      data.organization_id !== allowlist.organizationId ||
      (allowlist.userIds.size > 0 && !allowlist.userIds.has(data.user_id)) ||
      !allowlist.roleSlugs.has(data.role.slug)
    )
      return deadLetter('WORKOS_ALLOWLIST_REJECTED', rawBody);
    // Only supported role values can enter the v2 context/policy. Unknown
    // allowlisted slugs are a configuration error, not a permissive fallback.
    if (!isPolicyRole(data.role.slug)) return deadLetter('WORKOS_ALLOWLIST_REJECTED', rawBody);
    return {
      disposition: 'alert',
      alert: buildAlert(
        {
          schemaVersion: 1,
          source: 'workos',
          sourceEventId: envelope.id,
          kind: 'unauthorized_privilege_change',
          occurredAt: data.updated_at ?? envelope.created_at,
          tenantId: data.organization_id,
          subjectId: data.user_id,
          // Membership.updated has no actor or previous role in the 8.13
          // serialized contract; never infer either from current state.
          actor: { id: `workos:unknown:${envelope.id}`, type: 'unknown' },
          // A membership is the authoritative object for ordering a role
          // change. A user can have independent memberships and must not let
          // one tenant/object make another object's event appear stale.
          target: { id: data.id, type: 'membership' },
          changes: {
            membershipId: data.id,
            // Preserve the closed provider discriminator for the ordering
            // preflight. The incident kind is intentionally broader and
            // cannot distinguish future provider lifecycle event types.
            workosEventType: envelope.event,
            observedCurrentRole: data.role.slug,
            // Status is part of the authoritative membership state.  Leaving
            // it out would make two otherwise identical ordering positions
            // (for example active vs inactive) look safely equivalent.
            observedStatus: data.status,
          },
        },
        rawBody,
      ),
    };
  }
  const data = WorkOsSessionObjectSchema.parse(envelope.data);
  if (
    data.organization_id !== allowlist.organizationId ||
    (allowlist.userIds.size > 0 && !allowlist.userIds.has(data.user_id))
  )
    return deadLetter('WORKOS_ALLOWLIST_REJECTED', rawBody);
  return {
    disposition: 'alert',
    alert: buildAlert(
      {
        schemaVersion: 1,
        source: 'workos',
        sourceEventId: envelope.id,
        kind: 'disallowed_country_login',
        occurredAt: data.updated_at ?? data.created_at ?? envelope.created_at,
        tenantId: data.organization_id,
        subjectId: data.user_id,
        sessionId: data.id,
        ...(data.ip_address ? { ip: data.ip_address } : {}),
        actor: { id: `workos:unknown:${envelope.id}`, type: 'unknown' },
        target: { id: data.id, type: 'session' },
        // Do not collapse session.created and session.revoked into the
        // broader incident kind: the preflight hashes this allowlisted type
        // with the normalized session state.
        changes: {
          workosEventType: envelope.event,
          // Official session event payloads may omit status. The verified,
          // closed lifecycle discriminator defines the observed state.
          sessionStatus: envelope.event === 'session.created' ? 'active' : 'revoked',
        },
      },
      rawBody,
    ),
  };
}

function isPolicyRole(value: string | undefined): value is 'admin' | 'member' | 'viewer' {
  return value === 'admin' || value === 'member' || value === 'viewer';
}

function buildAlert(input: Omit<Alert, 'alertId' | 'rawPayloadRef' | 'idempotencyKey'>, rawBody: Uint8Array): Alert {
  const identityHash = createHash('sha256')
    .update(input.source, 'utf8')
    .update(Buffer.from([0]))
    .update(input.sourceEventId, 'utf8')
    .digest('hex');
  const rawHash = createHash('sha256').update(rawBody).digest('hex');
  return AlertSchema.parse({
    ...input,
    occurredAt: new Date(input.occurredAt).toISOString(),
    ...(input.ip ? { ip: canonicalizeIp(input.ip) } : {}),
    alertId: `alert_${identityHash}`,
    rawPayloadRef: `sha256:${rawHash}`,
    idempotencyKey: identityHash,
  });
}

function canonicalizeIp(ip: string): string {
  if (!ip.includes(':')) return ip;
  return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
}

function deadLetter(
  reasonCode: 'EVENT_UNKNOWN' | 'EVENT_VERSION_UNSUPPORTED' | 'WORKOS_ALLOWLIST_REJECTED',
  rawBody: Uint8Array,
): NormalizationResult {
  return {
    disposition: 'dead_letter',
    reasonCode,
    eventRef: `sha256:${createHash('sha256').update(rawBody).digest('hex')}`,
  };
}
