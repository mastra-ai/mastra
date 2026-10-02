import { cn } from '@mastra/playground-ui/utils/cn';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router';

import { externalLinkLabel, PULL_REQUEST_STATUS_LABELS, pullRequestStatusForItem } from '../boardItems';
import { relationshipLabel, workItemReferenceLabel } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { isPullRequestSource } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

const RELATED_ITEM_LINK_CLASS = `  hover:text-foreground relative z-10 flex w-fit max-w-full items-center gap-1 rounded-sm hover:underline ${focusRing}`;

export function RelatedWorkItemLink({
  item,
  href,
  kind,
}: {
  item: WorkItem;
  href: string;
  kind: 'board' | 'external' | 'session';
}) {
  const live = kind === 'session';
  const external = kind === 'external';
  const reference = workItemReferenceLabel(item);
  const relation = relationshipLabel(item);
  const titleSuffix = reference === undefined ? '' : ` — ${item.title}`;
  const pullRequestStatus = isPullRequestSource(item.source) ? pullRequestStatusForItem(item) : undefined;
  const statusLabel = pullRequestStatus === undefined ? undefined : PULL_REQUEST_STATUS_LABELS[pullRequestStatus];
  let ariaLabel = `Open ${relation}${titleSuffix}`;
  if (live) ariaLabel = `Open live session for ${relation}${titleSuffix}`;
  if (external) ariaLabel = `${externalLinkLabel(item.source)}: ${relation}${titleSuffix}`;
  if (statusLabel !== undefined) ariaLabel = `${ariaLabel}, ${statusLabel}`;

  const content = (
    <>
      {pullRequestStatus === undefined ? (
        <SourceIcon source={item.source} className="size-3" />
      ) : (
        <PullRequestStatusIcon status={pullRequestStatus} size={12} decorative />
      )}
      <span className="truncate">{reference ?? item.title}</span>
      {live && (
        <MessageSquare
          data-live-session-indicator
          size={11}
          className="text-badge-green-indicator shrink-0"
          aria-hidden
        />
      )}
    </>
  );
  let tooltip = reference === undefined ? relation : `${relation} · ${item.title}`;
  if (statusLabel !== undefined) tooltip = `${tooltip} · ${statusLabel}`;
  if (live) tooltip = `${tooltip} · Live session`;
  const link = external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      aria-label={ariaLabel}
      className={cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS)}
    >
      <Txt as="span" variant="meta">
        {content}
      </Txt>
    </a>
  ) : (
    <Link
      to={href}
      draggable={false}
      aria-label={ariaLabel}
      className={cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS)}
    >
      <Txt as="span" variant="meta" className="block">
        {content}
      </Txt>
    </Link>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="top" className="max-w-90">
        <span className="wrap-anywhere whitespace-pre-wrap">{tooltip}</span>
      </TooltipContent>
    </Tooltip>
  );
}
