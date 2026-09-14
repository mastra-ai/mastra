import { Txt } from '@mastra/playground-ui/components/Txt';
import { X } from 'lucide-react';

import { useKnowledgeActivity } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeActivityEvent, KnowledgeScopeNode, KnowledgeSelection } from '../../services/knowledge';
import { knowledgeActivityLabel } from './activityLabel';

interface KnowledgeScopeFlyoutProps {
  factoryProjectId: string;
  selection: KnowledgeSelection;
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
  selection,
  scope,
  childScopeCount,
  contentNodeCount,
  threadId,
  onSelectActivity,
  onClose,
}: KnowledgeScopeFlyoutProps) {
  const activity = useKnowledgeActivity(factoryProjectId, selection, threadId);
  const recentActivity = activity.data?.pages[0]?.events.slice(0, 5) ?? [];
  const displayAddress =
    scope.address === `resource:${factoryProjectId}` ? `project:${factoryProjectId}` : scope.address;
  return (
    <aside
      data-testid="knowledge-scope-flyout"
      aria-label={`${scope.name} scope details`}
      className="border-surface5 bg-surface2 absolute top-0 right-0 z-20 h-full w-80 overflow-y-auto border-l shadow-xl"
    >
      <header className="border-surface5 flex items-start gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <Txt as="h2" variant="header-sm" className="text-icon6 truncate font-semibold">
            {scope.name}
          </Txt>
          <div className="mt-1 text-xs text-purple-300">scope</div>
        </div>
        <button
          type="button"
          aria-label="Close scope details"
          className="text-icon3 hover:text-icon6 rounded p-1"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>

      <div className="space-y-5 p-4 text-sm">
        {scope.description?.trim() ? <p className="text-icon5 leading-relaxed">{scope.description}</p> : null}
        <dl className="text-icon4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt>Address</dt>
          <dd className="text-icon5 text-right break-all">{displayAddress}</dd>
          <dt>Kind</dt>
          <dd className="text-icon5 text-right">{scope.kind ?? 'scope'}</dd>
          <dt>Content nodes</dt>
          <dd className="text-icon5 text-right">{contentNodeCount}</dd>
          <dt>Child scopes</dt>
          <dd className="text-icon5 text-right">{childScopeCount}</dd>
          <dt>Direct members</dt>
          <dd className="text-icon5 text-right">{contentNodeCount + childScopeCount}</dd>
        </dl>

        <section aria-labelledby="scope-recent-activity">
          <Txt id="scope-recent-activity" as="h3" variant="ui-sm" className="text-icon6 font-medium">
            Recent activity
          </Txt>
          {activity.isPending ? (
            <p className="text-icon3 mt-2 text-xs">Loading…</p>
          ) : activity.isError ? (
            <p className="text-icon3 mt-2 text-xs">Unable to load recent activity.</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-icon3 mt-2 text-xs">No recent activity.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {recentActivity.map(event => (
                <li key={event.id} className="border-surface5 border-l pl-2 text-xs">
                  <span className="text-icon5">{knowledgeActivityLabel(event)}</span>
                  <span className="text-icon3"> · </span>
                  <button
                    type="button"
                    className="text-icon6 font-medium hover:text-purple-300 hover:underline"
                    onClick={() => onSelectActivity(event)}
                  >
                    {event.node.name}
                  </button>
                  <time className="text-icon3 mt-0.5 block" dateTime={event.createdAt}>
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
