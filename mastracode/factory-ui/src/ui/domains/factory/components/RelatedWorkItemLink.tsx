import { cardChangeRequest, isPullRequestSource } from '@internal/factory-contract';
import { RelatedItemLink } from '@mastra/playground-ui/domains/factory';

import { HrefLink } from '../../../ui/HrefLink';
import { CARD_SOURCES } from '../cardSources';
import { changeRequestStatus, changeRequestStatusLabel } from '../changeRequestState';
import type { PullRequestSubscription } from '../services/githubSubscriptions';
import { relatedCardName, relationshipLabel, workItemReference } from '../services/relationships';
import type { WorkItem } from '@internal/factory-contract';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

export { RELATED_ITEM_LINK_CLASS } from '@mastra/playground-ui/domains/factory';

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
      LinkComponent={HrefLink}
    />
  );
}
