import { cardChangeRequest } from '@mastra/factory/work-items/change-requests';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { Link } from 'react-router';

import { CARD_SOURCES } from '../cardSources';
import { changeRequestStatus, changeRequestStatusLabel } from '../changeRequestState';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { relatedCardName, relationshipLabel, workItemReference } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { isPullRequestSource } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { IconChatBubble7 } from '@mastra/playground-ui/icons/central/IconChatBubble7';

export const RELATED_ITEM_LINK_CLASS = `hover:text-foreground relative z-10 flex w-fit max-w-full items-center gap-1 rounded-sm hover:underline ${focusRing}`;

export function RelatedWorkItemLink({
  item,
  href,
  kind,
  contextRepository,
  subscriptions,
}: {
  item: WorkItem;
  href: string;
  kind: 'board' | 'external' | 'session';
  contextRepository?: string;
  subscriptions?: readonly PullRequestSubscription[];
}) {
  const live = kind === 'session';
  const external = kind === 'external';
  const reference = workItemReference(item, contextRepository);
  const relation = relationshipLabel(item, contextRepository);
  const name = relatedCardName(item, contextRepository);
  const pullRequest = isPullRequestSource(item.source) ? cardChangeRequest(item) : undefined;
  const pullRequestStatus = pullRequest && changeRequestStatus(pullRequest, subscriptions);
  const statusLabel =
    pullRequest && pullRequestStatus ? changeRequestStatusLabel(pullRequest.provider, pullRequestStatus) : undefined;
  let ariaLabel = `Open ${name}`;
  if (live) ariaLabel = `Open live session for ${name}`;
  if (external) ariaLabel = `${CARD_SOURCES[item.source].linkLabel}: ${name}`;
  if (statusLabel !== undefined) ariaLabel = `${ariaLabel}, ${statusLabel}`;

  const content = (
    <>
      {pullRequest && pullRequestStatus ? (
        <PullRequestStatusIcon status={pullRequestStatus} provider={pullRequest.provider} size={12} decorative />
      ) : (
        <SourceIcon source={item.source} className="size-3" />
      )}
      <Txt as="span" variant="meta" className="min-w-0 flex-1 truncate">
        {reference ?? item.title}
      </Txt>
      {live && (
        <IconChatBubble7
          data-live-session-indicator
          className="text-badge-green-indicator size-icon-xs shrink-0"
          aria-hidden
        />
      )}
    </>
  );
  const tooltipParts = [
    relation,
    ...(reference === undefined ? [] : [item.title]),
    ...(statusLabel === undefined ? [] : [statusLabel]),
    ...(live ? ['Live session'] : []),
  ];
  const link = external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      aria-label={ariaLabel}
      className={cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS)}
    >
      {content}
    </a>
  ) : (
    <Link
      to={href}
      draggable={false}
      aria-label={ariaLabel}
      className={cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS)}
    >
      {content}
    </Link>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="top" className="max-w-90">
        <Metadata>
          {tooltipParts.map((part, index) => (
            <Metadata.Item key={index}>{part}</Metadata.Item>
          ))}
        </Metadata>
      </TooltipContent>
    </Tooltip>
  );
}
