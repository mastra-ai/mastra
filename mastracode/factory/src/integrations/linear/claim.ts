/**
 * Org-wide ownership key for a Linear issue's Factory card. Keyed by the issue's
 * stable UUID, never its human identifier: identifiers change when an issue
 * moves between teams, and the UUID is unique across every Linear workspace, so
 * one key names one issue no matter which workspace or source it was read from.
 */
export function linearClaimKey(issueId: string): string {
  return `linear:issue:${issueId}`;
}
