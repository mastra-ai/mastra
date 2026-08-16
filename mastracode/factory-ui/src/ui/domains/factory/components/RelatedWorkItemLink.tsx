import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router';

import { pullRequestStatusForItem } from '../boardItems';
import { relationshipLabel, workItemReferenceLabel } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

const CLASS_NAME =
  'text-ui-xs text-icon4 hover:text-icon6 focus-visible:outline-accent1 relative z-10 flex w-fit max-w-full items-center gap-1 rounded-sm outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2';

export function RelatedWorkItemLink({
  item,
  href,
  external,
  live,
  ariaLabel,
}: {
  item: WorkItem;
  href: string;
  external: boolean;
  live: boolean;
  ariaLabel: string;
}) {
  const content = (
    <>
      {item.source === 'github-pr' ? (
        <PullRequestStatusIcon status={pullRequestStatusForItem(item)} size={12} decorative />
      ) : (
        <SourceIcon source={item.source} className="size-3" />
      )}
      <span className="truncate">{workItemReferenceLabel(item) ?? item.title}</span>
      {live && <MessageSquare size={11} className="text-accent1 shrink-0" aria-hidden />}
    </>
  );
  const tooltip = `${relationshipLabel(item)} · ${item.title}${live ? ' · Live session' : ''}`;
  const link = external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      className={CLASS_NAME}
      aria-label={ariaLabel}
    >
      {content}
    </a>
  ) : (
    <Link to={href} draggable={false} className={CLASS_NAME} aria-label={ariaLabel}>
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
