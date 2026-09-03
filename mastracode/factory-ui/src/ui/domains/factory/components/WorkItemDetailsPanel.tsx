import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EllipsisVertical, Minimize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { BoardCardStatus } from '../boardCardStatus';
import { externalLinkLabel } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import type { CardMorph } from '../hooks/useCardMorph';
import type { AuditEventPage } from '../services/audit';
import { workItemIdentifier } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { timelineEvents, workItemActivity } from '../workItemActivity';
import { SourceIcon } from './BoardIcons';
import { CardDetailsPanel } from './CardDetailsPanel';
import { WorkItemCardRows } from './WorkItemCardRows';
import { WorkItemTray } from './WorkItemTray';

export function WorkItemDetailsPanel({
  item,
  columnStage,
  projectRepositoryId,
  activityPage,
  morph,
  relatedLinks,
  status,
  actions,
  menu,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  projectRepositoryId: string;
  activityPage?: AuditEventPage;
  morph: CardMorph;
  relatedLinks: ReactNode;
  status: BoardCardStatus;
  actions: CardAction[];
  menu: ReactNode;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const titleId = useId();
  const auth = useFactoryAuth();
  const [searchParams] = useSearchParams();
  const highlightCommentId =
    searchParams.get('item') === item.id ? (searchParams.get('comment') ?? undefined) : undefined;

  const activity = workItemActivity(item, activityPage);
  const events = timelineEvents(activity);
  const actors = { ...activityPage?.actors, ...activity.extraActors };
  const identifier = workItemIdentifier(item);

  return (
    <CardDetailsPanel
      morph={morph}
      labelledBy={titleId}
      header={
        <WorkItemCardRows
          item={item}
          columnStage={columnStage}
          titleId={titleId}
          relatedLinks={relatedLinks}
          activity={activity}
          actors={actors}
          status={status}
          actions={actions}
          beforeStart={morph.closeDetails}
          open
          controls={
            <>
              {item.url !== null && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={identifier === undefined ? undefined : `${externalLinkLabel(item.source)}: ${identifier}`}
                  className={buttonVariants({ variant: 'ghost', size: 'xs' })}
                >
                  <SourceIcon source={item.source} />
                  {identifier ?? externalLinkLabel(item.source)}
                </a>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Collapse ${item.title}`}
                onClick={morph.closeDetails}
              >
                <Minimize2 size={13} aria-hidden />
              </Button>
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`All actions for ${item.title}`}>
                      <EllipsisVertical size={13} aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenu.Content align="end" className="min-w-44">
                  {menu}
                </DropdownMenu.Content>
              </DropdownMenu>
            </>
          }
        />
      }
    >
      <WorkItemTray
        item={item}
        factoryId={factoryId}
        projectRepositoryId={projectRepositoryId}
        enabled={morph.open}
        currentUser={auth.data?.user}
        highlightCommentId={highlightCommentId}
        events={events}
        actors={actors}
      />
    </CardDetailsPanel>
  );
}
