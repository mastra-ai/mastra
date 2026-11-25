import { cardChangeRequest } from '@mastra/factory/work-items/change-requests';
import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import type { ReactNode } from 'react';

import { cardLabels, metadataLabelColors } from '../boardItems';
import type { CardAction } from '../cardPrimaryAction';
import { CARD_SOURCES } from '../cardSources';
import { changeRequestStatus } from '../changeRequestState';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { isPullRequestSource } from '../services/workItems';
import type { WorkItem, WorkItemSource } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { MetadataLabels as SharedMetadataLabels } from '@mastra/playground-ui/domains/factory';
import './card-actions.css';

export function SourceTitle({ source, title }: { source: WorkItemSource; title: string }) {
  return (
    <>
      <span className="sr-only">{CARD_SOURCES[source].label}: </span>
      {title}
    </>
  );
}

export function WorkItemSourceIcon({
  item,
  subscriptions,
}: {
  item: WorkItem;
  subscriptions?: readonly PullRequestSubscription[];
}) {
  const request = cardChangeRequest(item);
  const pullRequestStatus = request && changeRequestStatus(request, subscriptions);
  if (!request || pullRequestStatus === undefined) return <SourceIcon source={item.source} />;
  const status = <PullRequestStatusIcon status={pullRequestStatus} provider={request.provider} />;
  if (isPullRequestSource(item.source)) return status;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <SourceIcon source={item.source} />
      {status}
    </span>
  );
}

// The app-wide provider fires at 0ms, which makes card-sized targets open as the pointer merely crosses them.
export function BoardTooltipDelay({ children }: { children: ReactNode }) {
  return <TooltipProvider delay={400}>{children}</TooltipProvider>;
}

export { CardStatus, REVEAL_ON_CARD_HOVER, SessionBadge } from '@mastra/playground-ui/domains/factory';

export function MetadataLabels({ metadata, className }: { metadata: Record<string, unknown>; className?: string }) {
  return (
    <SharedMetadataLabels labels={cardLabels(metadata)} colors={metadataLabelColors(metadata)} className={className} />
  );
}

export function CardActions({
  actions,
  trailing,
  children,
}: {
  actions: CardAction[];
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  if (actions.length === 0 && !children && !trailing) return null;
  const [main] = actions;
  return (
    <div className="mt-auto flex items-center justify-between gap-2">
      <div className="board-card-actions relative z-10 flex min-w-0">
        {actions.map(action => (
          <CardActionButton key={action.label} action={action} main={action === main} />
        ))}
        {children}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

// A routine move stays quiet so the one urgent pill on the board is the only raised control.
function pillVariant(action: CardAction, main: boolean) {
  return main && action.urgent && !action.disabled ? 'primary' : 'ghost';
}

function CardActionButton({ action, main }: { action: CardAction; main: boolean }) {
  // The lead action keeps its label whole; a narrow column eats into the ones behind it.
  const width = main ? 'shrink-0' : 'min-w-0';
  return (
    <Button
      type="button"
      variant={pillVariant(action, main)}
      size="sm"
      aria-label={action.ariaLabel}
      disabled={action.disabled}
      className={width}
      onClick={() => action.start()}
    >
      <span className="truncate">{action.label}</span>
    </Button>
  );
}
