import { isAuditAction } from '@mastra/factory/storage/domains/audit/actions';
import type { AuditAction } from '@mastra/factory/storage/domains/audit/actions';

import { entryTarget } from '../../../../activity';
import type { ActivityEntry } from '../../../../activity';
import { auditActionLabel } from '../../../../auditPresentation';

/** The verb that makes the rail read as prose; a row off the registry falls back to its own label. */
const DEED_PHRASES: Record<AuditAction, string> = {
  'factory.run.started': 'started a run on',
  'factory.run.ended': 'ended a run on',
  'factory.run.queued': 'queued a run on',
  'factory.run.rejected': 'rejected the run on',
  'factory.run.approved': 'approved the run on',
  'factory.run.dismissed': 'dismissed the run on',
  'factory.run.retry': 'retried the run on',
  'factory.git.commit': 'committed to',
  'factory.git.push': 'pushed to',
  'factory.git.pr_opened': 'opened a pull request for',
  'factory.agent.commit': 'committed to',
  'factory.agent.push': 'pushed to',
  'factory.agent.pr_opened': 'opened a pull request for',
  'factory.agent.signaled': 'signaled',
  'factory.work_item.created': 'created',
  'factory.work_item.updated': 'updated',
  'factory.work_item.deleted': 'deleted',
  'factory.work_item.stage_moved': 'moved',
  'factory.work_item.transition_rejected': 'was blocked moving',
  'factory.work_item.comment_created': 'commented:',
  'factory.work_item.comment_edited': 'edited a comment:',
  'factory.work_item.comment_deleted': 'deleted a comment:',
  'factory.work_item.comment_mentioned': 'mentioned someone:',
  'factory.work_item.labels_reconciled': 'reconciled the labels on',
  'factory.intake.config_updated': 'changed intake settings on',
  'factory.intake.binding_updated': 'changed an intake binding on',
  'factory.intake.label_route_updated': 'changed an intake label route on',
  'factory.session.owner_transferred': 'took ownership of',
};

/** What a sentence's verb points at: one card's title, a count of cards, or nothing at all (an intake setting has no title). */
export type DeedObject = 'title' | 'group' | 'none';

export function subjectCount(entries: ActivityEntry[]): number {
  return new Set(entries.map(entry => entryTarget(entry)?.id ?? entry.title)).size;
}

export function deedObject(entries: ActivityEntry[]): DeedObject {
  if (entries.every(entry => entry.title === '')) return 'none';
  return subjectCount(entries) > 1 ? 'group' : 'title';
}

export function namesSeveralCards(entries: ActivityEntry[]): boolean {
  return deedObject(entries) === 'group';
}

/** A comment's colon introduces its card; before a count it reads "commented on 3 cards". */
function deedPhrase(action: string, object: DeedObject): string {
  const phrase = isAuditAction(action) ? DEED_PHRASES[action] : auditActionLabel(action).toLowerCase();
  if (object === 'none') return phrase.replace(/ (?:on|to|for|of)$/, '');
  if (object === 'group') return phrase.replace(/:$/, ' on');
  return phrase;
}

export function entryVerb(entries: [ActivityEntry, ...ActivityEntry[]]): string {
  const [first] = entries;
  return first.kind === 'move' ? 'moved' : deedPhrase(first.action, deedObject(entries));
}
