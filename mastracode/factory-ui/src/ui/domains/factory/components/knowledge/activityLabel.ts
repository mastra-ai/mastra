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
  if (verb && (event.targetType === 'record' || event.targetType === 'node')) return `${verb} ${event.targetType}`;
  return event.action.replaceAll('-', ' ');
}

export const KNOWLEDGE_ACTIVITY_TRUNCATED =
  'This scope has more members than activity can cover; activity for some members is not shown.';
