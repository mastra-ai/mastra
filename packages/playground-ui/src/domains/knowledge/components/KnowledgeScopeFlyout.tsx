import { X } from 'lucide-react';

import { useKnowledgeDataSource } from '../data-source-context';
import { knowledgeActivityLabel, KNOWLEDGE_ACTIVITY_TRUNCATED } from '../lib/activityLabel';
import type { KnowledgeActivityEvent, KnowledgeScopeNode, KnowledgeSelection } from '../types';

import { Txt } from '@/ds/components/Txt';

interface KnowledgeScopeFlyoutProps {
  selection: KnowledgeSelection;
  scope: KnowledgeScopeNode;
  childScopeCount: number;
  contentNodeCount: number;
  /** True when the counts come from a truncated window and are lower bounds. */
  countsTruncated: boolean;
  onSelectActivity: (event: KnowledgeActivityEvent) => void;
  onClose: () => void;
}

/** Detail surface for the structural scope at the root of the active lens. */
export function KnowledgeScopeFlyout({
  selection,
  scope,
  childScopeCount,
  contentNodeCount,
  countsTruncated,
  onSelectActivity,
  onClose,
}: KnowledgeScopeFlyoutProps) {
  const count = (value: number) => (countsTruncated ? `${value}+` : String(value));
  const activity = useKnowledgeDataSource().useActivity(selection);
  const recentActivity = activity.data?.pages[0]?.events.slice(0, 5) ?? [];
  const activityTruncated = activity.data?.pages[0]?.truncated === true;
  return (
    <aside
      data-testid="knowledge-scope-flyout"
      aria-label={`${scope.name} scope details`}
      className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-border bg-background shadow-overlay md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none"
    >
      <header className="flex items-start gap-3 border-b border-border p-4">
        <div className="min-w-0 flex-1">
          <Txt as="h2" variant="subheading" tone="ink" className="truncate font-semibold">
            {scope.name}
          </Txt>
          <div className="mt-1 text-caption text-badge-purple-indicator">{scope.kind || 'topic'}</div>
        </div>
        <button
          type="button"
          aria-label="Close scope details"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className="space-y-5 p-4 text-body">
        {scope.description?.trim() ? <p className="leading-relaxed text-foreground">{scope.description}</p> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-caption text-muted-foreground">
          <dt>Address</dt>
          <dd className="text-right break-all text-foreground">{scope.address}</dd>
          <dt>Kind</dt>
          <dd className="text-right text-foreground">{scope.kind ?? 'scope'}</dd>
          <dt>Content nodes</dt>
          <dd className="text-right text-foreground">{count(contentNodeCount)}</dd>
          <dt>Child scopes</dt>
          <dd className="text-right text-foreground">{count(childScopeCount)}</dd>
          <dt>Direct members</dt>
          <dd className="text-right text-foreground">{count(contentNodeCount + childScopeCount)}</dd>
        </dl>

        <section aria-labelledby="scope-recent-activity">
          <Txt id="scope-recent-activity" as="h3" variant="caption" tone="ink" className="font-medium">
            Recent activity
          </Txt>
          {activity.isPending ? (
            <p className="mt-2 text-caption text-muted-foreground">Loading…</p>
          ) : activity.isError ? (
            <p className="mt-2 text-caption text-muted-foreground">Unable to load recent activity.</p>
          ) : recentActivity.length === 0 ? (
            <p className="mt-2 text-caption text-muted-foreground">No recent activity.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {recentActivity.map(event => (
                <li key={event.id} className="border-l border-border pl-2 text-caption">
                  <span className="text-foreground">{knowledgeActivityLabel(event)}</span>
                  <span className="text-muted-foreground"> · </span>
                  <button
                    type="button"
                    className="font-medium text-foreground hover:text-badge-purple-indicator hover:underline"
                    onClick={() => onSelectActivity(event)}
                  >
                    {event.node.name}
                  </button>
                  <time className="mt-0.5 block text-muted-foreground" dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
          {activityTruncated ? (
            <p className="mt-2 text-caption text-muted-foreground">{KNOWLEDGE_ACTIVITY_TRUNCATED}</p>
          ) : null}
        </section>
      </div>
    </aside>
  );
}
