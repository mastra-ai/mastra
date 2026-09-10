export const AUDIT_ACTOR_TYPES = ['human', 'agent', 'system'] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export function isAuditActorType(value: unknown): value is AuditActorType {
  return AUDIT_ACTOR_TYPES.some(type => type === value);
}

/** Ids the factory writes for itself: never a person, so never a profile lookup. */
const AUTOMATION_ACTORS = new Set([
  'factory',
  'system',
  'automation',
  'factory-rule-dispatcher',
  'factory-tool-result-rule',
]);

export function isHumanActorId(actorId: string | undefined): actorId is string {
  if (!actorId) return false;
  return !AUTOMATION_ACTORS.has(actorId) && !actorId.startsWith('agent:') && !actorId.startsWith('github:');
}
