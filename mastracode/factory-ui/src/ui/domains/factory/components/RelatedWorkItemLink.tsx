import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router';

import { externalLinkLabel, PULL_REQUEST_STATUS_LABELS, pullRequestStatusForItem } from '../boardItems';
import { relationshipLabel, workItemReferenceLabel } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

const RELATED_ITEM_LINK_CLASS =
  'text-ui-xs text-icon4 hover:text-icon6 focus-visible:outline-accent1 relative z-10 flex w-fit max-w-full items-center gap-1 rounded-sm outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2';

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
  const pullRequestStatus = item.source === 'github-pr' ? pullRequestStatusForItem(item) : undefined;
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
      {live && <MessageSquare data-live-session-indicator size={11} className="text-accent1 shrink-0" aria-hidden />}
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
      className={RELATED_ITEM_LINK_CLASS}
      aria-label={ariaLabel}
    >
      {content}
    </a>
  ) : (
    <Link to={href} draggable={false} className={RELATED_ITEM_LINK_CLASS} aria-label={ariaLabel}>
      {content}
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
