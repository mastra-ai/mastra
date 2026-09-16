import { knownExternalAuthor } from '@mastra/factory/rules/types';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

import type { BoardCardStatus } from '../boardCardStatus';
import type { CardAction } from '../cardPrimaryAction';
import { metadataLabels, pullRequestStatusForItem, workItemMeta } from '../boardItems';
import { itemStageLabel } from '../boardStages';
import type { AuditActorProfile } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import type { WorkItemActivity as WorkItemActivityData } from '../workItemActivity';
import { CardActions, CardLabels, CardStatus, SourceTitle } from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { WorkItemActivity } from './WorkItemActivity';

// The card and its open copy render these same rows, so opening moves none of them.
export function WorkItemCardRows({
  item,
  columnStage,
  titleId,
  relatedLinks,
  activity,
  actors,
  status,
  actions,
  beforeStart,
  controls,
  open,
}: {
  item: WorkItem;
  columnStage: BoardStageId;
  titleId?: string;
  relatedLinks: ReactNode;
  activity: WorkItemActivityData;
  actors: Record<string, AuditActorProfile>;
  status: BoardCardStatus;
  /** Bottom left, the likeliest first. */
  actions: CardAction[];
  beforeStart?: () => void;
  /** The top-right group: the card's menu, or the copy's link, collapse and menu. */
  controls: ReactNode;
  /** The copy: its labelled source link and two controls to clear. */
  open: boolean;
}) {
  const labels = metadataLabels(item.metadata);
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const external = knownExternalAuthor(item);

  return (
    <>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">{controls}</div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className={cn('flex min-w-0 items-center gap-1.5', open ? 'pr-44' : 'pr-16')}>
          <span className="text-ui-xs text-icon2 min-w-0 truncate">{workItemMeta(item)}</span>
          {relatedLinks}
          {item.commentCount > 0 && (
            <span
              className="text-ui-xs text-icon2 flex shrink-0 items-center gap-1"
              aria-label={`${item.commentCount} ${item.commentCount === 1 ? 'comment' : 'comments'}`}
            >
              <MessageSquare size={11} aria-hidden />
              {item.commentCount}
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 tracking-tight">
          {item.source === 'github-pr' ? (
            <PullRequestStatusIcon status={pullRequestStatusForItem(item)} />
          ) : (
            <SourceIcon source={item.source} />
          )}
          <span className="text-ui-smd text-icon6 min-w-0 flex-1 truncate font-[550]">
            <SourceTitle source={item.source} title={item.title} id={titleId} />
          </span>
        </div>
      </div>
      <CardLabels labels={labels} />
      {otherStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {otherStages.map(stage => (
            <span key={stage} className="border-border1 text-ui-xs text-icon4 rounded-full border px-2 py-0.5">
              {itemStageLabel(item, stage)}
            </span>
          ))}
        </div>
      )}
      {(status.kind !== 'idle' || external) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <CardStatus status={status} />
          {external && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge size="xs" tabIndex={0} className="relative z-10 ml-auto">
                    External
                  </Badge>
                }
              />
              <TooltipContent side="bottom" className="max-w-64">
                From someone without write access — never starts a run on its own, even with auto-start runs on.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <CardActions
        actions={actions}
        beforeStart={beforeStart}
        trailing={<WorkItemActivity activity={activity} actors={actors} />}
      />
    </>
  );
}
