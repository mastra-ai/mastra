/**
 * Org-wide ownership key for a Jira issue's Factory card. Keyed by the issue
 * reference the intake feed serves as `id` — the direct integration's stable
 * Jira issue id, or the Platform-encoded issue reference (connection + key +
 * project). Either way one key names one issue across every Factory project,
 * so a single live card holds the claim org-wide.
 */
export function jiraClaimKey(issueRef: string): string {
  return `jira:issue:${issueRef}`;
}
