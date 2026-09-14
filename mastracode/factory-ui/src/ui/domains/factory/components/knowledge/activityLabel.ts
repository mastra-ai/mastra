import type { KnowledgeActivityEvent } from '../../services/knowledge';

export function knowledgeActivityLabel(event: KnowledgeActivityEvent): string {
  switch (event.action) {
    case 'knowledge-appended':
    case 'record-created':
      return 'new record';
    case 'record-deleted':
      return 'deleted record';
    case 'record-restored':
      return 'restored record';
    case 'record-rescoped':
      return 'moved record';
    case 'node-created':
      return 'new node';
    case 'node-updated':
      return 'updated node';
    case 'node-merged':
      return 'merged node';
    default:
      return event.action.replaceAll('-', ' ');
  }
}
