import type {
  FactoryAttentionItem,
  FactoryAttentionKind,
  FactoryAttentionKindSummaries,
  FactoryAttentionKindSummary,
} from '../../src/ui/domains/factory/services/attention';

function summarize(items: FactoryAttentionItem[], kind: FactoryAttentionKind): FactoryAttentionKindSummary {
  const ofKind = items.filter(item => item.kind === kind);
  const newest = ofKind.reduce<FactoryAttentionItem | undefined>(
    (best, item) => (!best || Date.parse(item.occurredAt) > Date.parse(best.occurredAt) ? item : best),
    undefined,
  );
  return {
    open: ofKind.filter(item => !item.archived).length,
    unread: ofKind.filter(item => !item.read && !item.archived).length,
    latest: newest ? { key: newest.key, at: newest.occurredAt, unread: !newest.read && !newest.archived } : null,
  };
}

/** What the attention route reports per kind for these items, whatever slice of them a page lists. */
export function attentionKindSummaries(items: FactoryAttentionItem[]): FactoryAttentionKindSummaries {
  return {
    'automation-failed': summarize(items, 'automation-failed'),
    'automation-proposed': summarize(items, 'automation-proposed'),
    mention: summarize(items, 'mention'),
    activity: summarize(items, 'activity'),
    'supervisor-finding': summarize(items, 'supervisor-finding'),
    'agent-waiting': summarize(items, 'agent-waiting'),
  };
}
