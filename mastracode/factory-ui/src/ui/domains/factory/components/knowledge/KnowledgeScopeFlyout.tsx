import { Txt } from '@mastra/playground-ui/components/Txt';
import { X } from 'lucide-react';

import { useKnowledgeActivity } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeActivityEvent, KnowledgeScopeNode } from '../../services/knowledge';
import { knowledgeActivityLabel } from './activityLabel';

interface KnowledgeScopeFlyoutProps {
  factoryProjectId: string;
  scope: KnowledgeScopeNode;
  childScopeCount: number;
  contentNodeCount: number;
  threadId?: string;
  onSelectActivity: (event: KnowledgeActivityEvent) => void;
  onClose: () => void;
}

/** Detail surface for the structural scope at the root of the active lens. */
export function KnowledgeScopeFlyout({
  factoryProjectId,
  scope,
  childScopeCount,
  contentNodeCount,
  threadId,
  onSelectActivity,
  onClose,
}: KnowledgeScopeFlyoutProps) {
  const activity = useKnowledgeActivity(factoryProjectId, scope.id, threadId, {});
  const recentActivity = activity.data?.pages[0]?.events.slice(0, 5) ?? [];
  const displayAddress =
    scope.address === `resource:${factoryProjectId}` ? `project:${factoryProjectId}` : scope.address;
  return (
    <aside
      data-testid="knowledge-scope-flyout"
      aria-label={`${scope.name} scope details`}
      className="border-border bg-background absolute top-0 right-0 z-20 h-full w-80 overflow-y-auto border-l shadow-xl"
    >
      <header className="border-border flex items-start gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <Txt as="h2" variant="subheading" className="text-foreground truncate font-semibold">
            {scope.name}
          </Txt>
          <div className="mt-1 text-xs text-purple-300">scope</div>
        </div>
        <button
          type="button"
          aria-label="Close scope details"
          className="text-muted-foreground hover:text-foreground rounded p-1"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className="space-y-5 p-4 text-sm">
        {scope.description?.trim() ? <p className="text-foreground leading-relaxed">{scope.description}</p> : null}
        <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt>Address</dt>
          <dd className="text-foreground text-right break-all">{displayAddress}</dd>
          <dt>Kind</dt>
          <dd className="text-foreground text-right">{scope.kind ?? 'scope'}</dd>
          <dt>Content nodes</dt>
          <dd className="text-foreground text-right">{contentNodeCount}</dd>
          <dt>Child scopes</dt>
          <dd className="text-foreground text-right">{childScopeCount}</dd>
          <dt>Direct members</dt>
          <dd className="text-foreground text-right">{contentNodeCount + childScopeCount}</dd>
        </dl>

        <section aria-labelledby="scope-recent-activity">
          <Txt id="scope-recent-activity" as="h3" variant="caption" className="text-foreground font-medium">
            Recent activity
          </Txt>
          {activity.isPending ? (
            <p className="text-muted-foreground mt-2 text-xs">Loading…</p>
          ) : activity.isError ? (
            <p className="text-muted-foreground mt-2 text-xs">Unable to load recent activity.</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">No recent activity.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {recentActivity.map(event => (
                <li key={event.id} className="border-border border-l pl-2 text-xs">
                  <span className="text-foreground">{knowledgeActivityLabel(event)}</span>
                  <span className="text-muted-foreground"> · </span>
                  <button
                    type="button"
                    className="text-foreground font-medium hover:text-purple-300 hover:underline"
                    onClick={() => onSelectActivity(event)}
                  >
                    {event.targetType}
                  </button>
                  <time className="text-muted-foreground mt-0.5 block" dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </aside>
  );
}
