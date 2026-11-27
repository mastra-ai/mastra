import { cardChangeRequest, isPullRequestSource } from '@internal/factory-contract';
import type { WorkItem } from '@mastra/client-js';

import { RelatedItemLink } from '../board';
import type { BoardNavigation } from '../board';
import { CARD_SOURCES } from '../board/card-sources';
import { SourceIcon } from './board-icons';
import { changeRequestStatus, changeRequestStatusLabel } from './change-request-state';
import type { PullRequestSubscription } from './change-request-state';
import { PullRequestStatusIcon } from './pull-request-status-icon';
import { relatedCardName, relationshipLabel, workItemReference } from './relationships';

export { RELATED_ITEM_LINK_CLASS } from '../board';

export function RelatedWorkItemLink({
  item,
  href,
  kind,
  contextRepository,
  subscriptions,
  LinkComponent,
}: {
  item: WorkItem;
  href: string;
  kind: 'board' | 'external' | 'session';
  contextRepository?: string;
  subscriptions?: readonly PullRequestSubscription[];
  LinkComponent: BoardNavigation['LinkComponent'];
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

  return (
    <RelatedItemLink
      href={href}
      icon={
        pullRequest && pullRequestStatus ? (
          <PullRequestStatusIcon status={pullRequestStatus} provider={pullRequest.provider} size={12} decorative />
        ) : (
          <SourceIcon source={item.source} className="size-3" />
        )
      }
      label={reference ?? item.title}
      ariaLabel={ariaLabel}
      tooltip={[
        relation,
        ...(reference === undefined ? [] : [item.title]),
        ...(statusLabel === undefined ? [] : [statusLabel]),
        ...(live ? ['Live session'] : []),
      ]}
      live={live}
      external={external}
      LinkComponent={LinkComponent}
    />
  );
}
