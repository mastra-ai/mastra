/**
 * Org-wide ownership key for an incident.io follow-up's Factory card. Keyed by
 * the prefixed item reference the intake feed serves as `id`
 * (`incidentio:follow-up:<ulid>`), which is globally unique across accounts,
 * so a single live card holds the claim org-wide.
 */
export function incidentioClaimKey(itemRef: string): string {
  return `incidentio:item:${itemRef}`;
}
