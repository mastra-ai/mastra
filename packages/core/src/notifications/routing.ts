import type { AgentScopeEntry } from '../agent/scopes';
import type { NotificationRecord } from './types';

/**
 * Reserved `metadata` key holding the routing requirement the caller asked for
 * when it created the record. A delayed delivery rebuilds its target from the
 * record, so a requirement like `requireClaimedOwner`, or the scopes the run it
 * starts must hold, has to travel with it;
 * metadata carries it without adding a column that every storage adapter would
 * have to migrate. It is stripped from the signals Core emits.
 */
const NOTIFICATION_ROUTING_METADATA_KEY = '__mastraNotificationRouting';

export type NotificationRoutingRequirement = {
  /** Reject the delivery unless an advertised thread owner acknowledges it. */
  requireClaimedOwner?: boolean;
  /** Scopes for the run this notification starts. */
  scopes?: AgentScopeEntry[];
};

export function readNotificationRoutingRequirement(
  metadata: NotificationRecord['metadata'],
): NotificationRoutingRequirement | undefined {
  const stored = metadata?.[NOTIFICATION_ROUTING_METADATA_KEY];
  if (!stored || typeof stored !== 'object') return undefined;
  const requirement = stored as NotificationRoutingRequirement;
  const read: NotificationRoutingRequirement = {
    ...(requirement.requireClaimedOwner === true ? { requireClaimedOwner: true } : {}),
    ...(Array.isArray(requirement.scopes) && requirement.scopes.length ? { scopes: requirement.scopes } : {}),
  };
  return read.requireClaimedOwner || read.scopes ? read : undefined;
}

/**
 * Store a requirement on a record's metadata, leaving other metadata alone. Caller metadata
 * never supplies the reserved key: its scopes would start the delayed run, so any copy the
 * caller sent is dropped, even when there is no requirement to store.
 */
export function applyNotificationRoutingRequirement(
  metadata: NotificationRecord['metadata'],
  requirement: NotificationRoutingRequirement,
): NotificationRecord['metadata'] {
  const callerMetadata = stripNotificationRoutingRequirement(metadata);
  const stored: NotificationRoutingRequirement = {
    ...(requirement.requireClaimedOwner ? { requireClaimedOwner: true } : {}),
    ...(requirement.scopes?.length ? { scopes: requirement.scopes } : {}),
  };
  if (!stored.requireClaimedOwner && !stored.scopes) return callerMetadata;
  return { ...callerMetadata, [NOTIFICATION_ROUTING_METADATA_KEY]: stored };
}

/** Drop the reserved key so it never reaches a delivered signal or a recipient. */
export function stripNotificationRoutingRequirement(
  metadata: NotificationRecord['metadata'],
): NotificationRecord['metadata'] {
  if (!metadata || !(NOTIFICATION_ROUTING_METADATA_KEY in metadata)) return metadata;
  const { [NOTIFICATION_ROUTING_METADATA_KEY]: _requirement, ...rest } = metadata;
  return rest;
}
