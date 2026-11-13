import type { IssueReconcileOne } from '../../issue-reconciler.js';
import type { PlatformConnectEventDelivery } from '../foundation/events-worker.js';
import { decodeIssueReference } from './intake.js';

/**
 * The issue a Jira issue or comment webhook names, as its key and id (cards
 * store the key; `issue.id` covers references stored by id). Nothing else is
 * read from the payload: the issue's state comes from Jira.
 */
export function jiraIssueFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const issue = (payload as { issue?: unknown }).issue;
  if (!issue || typeof issue !== 'object') return [];
  const { id, key } = issue as { id?: unknown; key?: unknown };
  return [key, typeof id === 'number' && Number.isSafeInteger(id) ? String(id) : id].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

/**
 * Re-fetches the issue a Jira event names and reconciles its cards. The
 * payload only names the issue, so an unverified event is safe here: at worst
 * it causes a re-fetch of an issue Factory already tracks.
 */
export async function handleJiraConnectEvent(
  event: PlatformConnectEventDelivery,
  reconcileOne: IssueReconcileOne | null,
): Promise<void> {
  const issue = jiraIssueFromPayload(event.payload);
  if (issue.length === 0 || !reconcileOne) return;
  const summary = await reconcileOne(externalId => {
    const reference = decodeIssueReference(externalId);
    return reference?.connectionId === event.connectionId && issue.includes(reference.issueId);
  });
  if (summary.failed > 0) {
    throw new Error(`Jira issue ${issue[0]} could not be reconciled: ${summary.errors[0]?.error ?? 'unknown error'}`);
  }
}
