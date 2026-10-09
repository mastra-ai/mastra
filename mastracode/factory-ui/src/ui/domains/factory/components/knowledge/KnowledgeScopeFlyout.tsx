import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { X } from 'lucide-react';

import { useKnowledgeActivity } from '../../../../../hooks/useKnowledgeGraph';
import type { KnowledgeScopeTreeNode } from '../../services/knowledge';
import { knowledgeActivityLabel, KNOWLEDGE_ACTIVITY_TRUNCATED } from './activityLabel';

const NO_FILTERS = {};

interface KnowledgeScopeFlyoutProps {
  factoryProjectId: string;
  scope: KnowledgeScopeTreeNode;
  threadId?: string;
  onOpenActivity: () => void;
  onClose: () => void;
}

/** Detail surface for the structural scope at the root of the active lens. */
export function KnowledgeScopeFlyout({
  factoryProjectId,
  scope,
  threadId,
  onOpenActivity,
  onClose,
}: KnowledgeScopeFlyoutProps) {
  const count = (value: number) => (scope.memberCountTruncated ? `${value}+` : String(value));
  const activity = useKnowledgeActivity(factoryProjectId, scope.id, threadId, NO_FILTERS);
  const firstPage = activity.data?.pages[0];
  const recentActivity = firstPage?.events.slice(0, 5) ?? [];
  const term = textStyle({ variant: 'caption', tone: 'muted' });
  const value = `${textStyle({ variant: 'caption', tone: 'ink' })} text-right`;
  return (
    <aside
      data-testid="knowledge-scope-flyout"
      aria-label={`${scope.name} scope details`}
      className="border-border bg-card shadow-overlay fixed inset-x-0 bottom-0 z-30 flex max-h-[70vh] flex-col overflow-y-auto rounded-t-xl border-t md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none"
    >
      <header className="flex items-start gap-2 px-4 py-3">
        <div className="min-w-0">
          <Txt as="h2" variant="subheading" tone="ink" className="truncate">
            {scope.name}
          </Txt>
          <Txt as="span" variant="meta" tone="muted" className="bg-fill mt-1 inline-block rounded px-1.5 py-0.5">
            {scope.kind}
          </Txt>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close scope details" className="ml-auto" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="space-y-5 px-4 pb-4">
        {scope.description?.trim() ? (
          <Txt as="p" variant="body-sm" tone="ink" className="break-words">
            {scope.description}
          </Txt>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className={term}>Content nodes</dt>
          <dd className={value}>{count(scope.contentNodeCount)}</dd>
          <dt className={term}>Child scopes</dt>
          <dd className={value}>{count(scope.childScopeCount)}</dd>
          <dt className={term}>Direct members</dt>
          <dd className={value}>{count(scope.memberCount)}</dd>
        </dl>

        <section aria-labelledby="scope-recent-activity">
          <div className="flex items-center justify-between gap-2">
            <Txt id="scope-recent-activity" as="h3" variant="label" tone="ink">
              Recent activity
            </Txt>
            <Button variant="ghost" size="sm" onClick={onOpenActivity}>
              View all
            </Button>
          </div>
          {activity.isPending ? (
            <Txt as="p" variant="caption" tone="muted" className="mt-2">
              Loading…
            </Txt>
          ) : activity.isError ? (
            <Txt as="p" variant="caption" tone="muted" className="mt-2">
              Unable to load recent activity.
            </Txt>
          ) : recentActivity.length === 0 ? (
            <Txt as="p" variant="caption" tone="muted" className="mt-2">
              No recent activity.
            </Txt>
          ) : (
            <ol className="mt-2 space-y-2">
              {recentActivity.map(event => (
                <li key={event.id} className="border-border border-l pl-2">
                  <Txt as="span" variant="caption" tone="ink">
                    {knowledgeActivityLabel(event)}
                  </Txt>
                  <time className={`${term} mt-0.5 block`} dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
          {firstPage?.truncated ? (
            <Txt as="p" variant="caption" tone="muted" className="mt-2">
              {KNOWLEDGE_ACTIVITY_TRUNCATED}
            </Txt>
          ) : null}
        </section>
      </div>
    </aside>
  );
}
