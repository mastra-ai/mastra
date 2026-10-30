import type { Card, WorkItemsStorage } from '../../storage/domains/work-items/base.js';

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

/** Every card the org holds for one Jira issue: its claimant, plus cards filed before claims existed. */
export async function jiraIssueCards(
  workItems: Pick<WorkItemsStorage, 'getByClaimKey' | 'listBySource'>,
  { orgId, issueRef }: { orgId: string; issueRef: string },
): Promise<Card[]> {
  const [claimant, legacy] = await Promise.all([
    workItems.getByClaimKey({ orgId, claimKey: jiraClaimKey(issueRef) }),
    workItems.listBySource({ orgId, source: { integrationId: 'jira', type: 'issue', externalId: issueRef } }),
  ]);
  return claimant ? [claimant, ...legacy] : legacy;
}

/** Whether `factoryProjectId` holds a card for the issue, live or finished. Without card storage nothing is filed. */
export async function jiraIssueFiledIn(
  workItems: Pick<WorkItemsStorage, 'getByClaimKey' | 'listBySource'> | undefined,
  { orgId, factoryProjectId, issueRef }: { orgId: string; factoryProjectId: string; issueRef: string },
): Promise<boolean> {
  if (!workItems) return false;
  const cards = await jiraIssueCards(workItems, { orgId, issueRef });
  return cards.some(card => card.factoryProjectId === factoryProjectId);
}
