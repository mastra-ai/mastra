import { cardChangeRequests } from '@internal/factory-contract';
import type { WorkItem } from '@mastra/client-js';
import { UpstreamLinks } from '../board';

import type { UpstreamLink } from '../board';
import { CARD_SOURCES } from '../board/card-sources';
import { SourceIcon } from './board-icons';
import { CHANGE_REQUEST_TERMS, changeRequestStatus } from './change-request-state';
import { PullRequestStatusIcon } from './pull-request-status-icon';
import { workItemIdentifier, workItemShortReference } from './relationships';
import { changeRequestLinkLabel, changeRequestRepository } from './session-change-requests';

function upstreamLinks(item: WorkItem, shownAsRelated: readonly string[], short: boolean): UpstreamLink[] {
  const origin = item.url;
  const own: UpstreamLink[] = [];
  if (origin !== null) {
    const { linkLabel } = CARD_SOURCES[item.source];
    const label = (short ? workItemShortReference(item) : workItemIdentifier(item)) ?? linkLabel;
    own.push({
      url: origin,
      label,
      ariaLabel: `${linkLabel}: ${label}`,
      icon: <SourceIcon source={item.source} className="size-3" />,
    });
  }
  const attached = cardChangeRequests(item).flatMap(request => {
    if (request.url === undefined || request.url === origin || shownAsRelated.includes(request.url)) return [];
    const { kind, sigil, source } = CHANGE_REQUEST_TERMS[request.provider];
    const label =
      request.number === undefined ? kind : `${changeRequestRepository(request.url) ?? ''}${sigil}${request.number}`;
    const status = changeRequestStatus(request);
    return [
      {
        url: request.url,
        label,
        ariaLabel: changeRequestLinkLabel(label, status),
        icon:
          status === undefined ? (
            <SourceIcon source={source} className="size-3" />
          ) : (
            <PullRequestStatusIcon status={status} provider={request.provider} size={12} decorative />
          ),
      },
    ];
  });
  return [...own, ...attached];
}

/**
 * Where the card lives upstream: its own issue or pull request, then each attached one no related card links already.
 * `short` drops the repository owner from the card's own key, for list rows where space is tight.
 */
export function WorkItemUpstreamLinks({
  item,
  shownAsRelated,
  short = false,
}: {
  item: WorkItem;
  shownAsRelated: readonly string[];
  short?: boolean;
}) {
  return <UpstreamLinks links={upstreamLinks(item, shownAsRelated, short)} />;
}
