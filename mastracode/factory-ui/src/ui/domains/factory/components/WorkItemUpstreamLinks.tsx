import { cardChangeRequests } from '@internal/factory-contract';
import { UpstreamLinks } from '@mastra/playground-ui/domains/factory';
import type { UpstreamLink } from '@mastra/playground-ui/domains/factory';

import { CARD_SOURCES } from '../cardSources';
import { CHANGE_REQUEST_TERMS, changeRequestStatus } from '../changeRequestState';
import { changeRequestLinkLabel, changeRequestRepository } from '../sessionChangeRequests';
import { workItemIdentifier, workItemShortReference } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

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
