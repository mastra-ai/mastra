import type { KnowledgeActivityEvent } from '../../services/knowledge';

const ACTION_VERBS: Record<string, string> = {
  create: 'new',
  edit: 'updated',
  delete: 'deleted',
  restore: 'restored',
  move: 'moved',
  merge: 'merged',
  promote: 'promoted',
  demote: 'demoted',
  stamp: 'stamped',
  rebind: 'rebound',
  skip: 'skipped',
};

export function knowledgeActivityLabel(event: KnowledgeActivityEvent): string {
  const verb = ACTION_VERBS[event.action];
  if (verb && (event.recordType === 'record' || event.recordType === 'node')) return `${verb} ${event.recordType}`;
  return event.action.replaceAll('-', ' ');
}
