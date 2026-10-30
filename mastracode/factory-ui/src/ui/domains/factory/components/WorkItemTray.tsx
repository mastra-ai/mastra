import { Txt } from '@mastra/playground-ui/components/Txt';
import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import { History } from 'lucide-react';

import type { AuditActorProfile, AuditEvent } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import { CardSourceDescription } from './BoardCardDetails';
import { ActivityEvent } from './WorkItemActivity';
import { WorkItemDescription } from './WorkItemDescription';

// The card itself on top, then its runs and moves in time order.
export function WorkItemTray({
  item,
  factoryId,
  projectRepositoryId,
  events,
  actors,
}: {
  item: WorkItem;
  factoryId: string;
  projectRepositoryId: string;
  events: AuditEvent[];
  actors: Record<string, AuditActorProfile>;
}) {
  const factoryProjectId = factoryId || undefined;

  return (
    <ScrollArea className="min-h-0 grow px-1">
      <ScrollAreaViewport>
        <div className="bg-fill mx-1 my-2 flex flex-col gap-2 rounded-lg p-3">
          <Txt as="h3" variant="card-title" tone="ink" className="m-0 wrap-anywhere">
            {item.title}
          </Txt>
          <CardSourceDescription
            item={item}
            projectRepositoryId={projectRepositoryId}
            factoryProjectId={factoryProjectId}
          />
          <WorkItemDescription item={item} factoryProjectId={factoryProjectId} />
        </div>
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="bg-border h-px flex-1" />
          <Txt tone="muted" as="span" variant="meta" className="block">
            Activity
          </Txt>
          <span className="bg-border h-px flex-1" />
        </div>
        {events.length === 0 ? (
          <div className="text-muted-foreground flex items-center justify-center gap-1.5 px-2 py-6">
            <History size={14} aria-hidden />
            <Txt as="span" variant="caption">
              No activity yet
            </Txt>
          </div>
        ) : (
          <ol aria-label="Activity" className="m-0 list-none px-1 py-1">
            {[...events]
              .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))
              .map(event => (
                <li key={event.id}>
                  <ActivityEvent event={event} actors={actors} className="px-2 py-1.5" />
                </li>
              ))}
          </ol>
        )}
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
