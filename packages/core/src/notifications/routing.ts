import type { NotificationRecord } from './types';

/**
 * Reserved `metadata` key holding the routing requirement the caller asked for
 * when it created the record. A delayed delivery rebuilds its target from the
 * record, so a requirement like `requireClaimedOwner` has to travel with it;
 * metadata carries it without adding a column that every storage adapter would
 * have to migrate. It is stripped from the signals Core emits.
 */
const NOTIFICATION_ROUTING_METADATA_KEY = '__mastraNotificationRouting';

export type NotificationRoutingRequirement = {
  /** Reject the delivery unless an advertised thread owner acknowledges it. */
  requireClaimedOwner?: boolean;
};

export function readNotificationRoutingRequirement(
  metadata: NotificationRecord['metadata'],
): NotificationRoutingRequirement | undefined {
  const stored = metadata?.[NOTIFICATION_ROUTING_METADATA_KEY];
  if (!stored || typeof stored !== 'object') return undefined;
  const requirement = stored as NotificationRoutingRequirement;
  return requirement.requireClaimedOwner === true ? { requireClaimedOwner: true } : undefined;
}

/** Store a requirement on a record's metadata, leaving other metadata alone. */
export function applyNotificationRoutingRequirement(
  metadata: NotificationRecord['metadata'],
  requirement: NotificationRoutingRequirement,
): NotificationRecord['metadata'] {
  if (!requirement.requireClaimedOwner) return metadata;
  return { ...metadata, [NOTIFICATION_ROUTING_METADATA_KEY]: { requireClaimedOwner: true } };
}

/** Drop the reserved key so it never reaches a delivered signal or a recipient. */
export function stripNotificationRoutingRequirement(
  metadata: NotificationRecord['metadata'],
): NotificationRecord['metadata'] {
  if (!metadata || !(NOTIFICATION_ROUTING_METADATA_KEY in metadata)) return metadata;
  const { [NOTIFICATION_ROUTING_METADATA_KEY]: _requirement, ...rest } = metadata;
  return rest;
}
