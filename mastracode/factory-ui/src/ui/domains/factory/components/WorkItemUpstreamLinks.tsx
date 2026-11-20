import { cardChangeRequests } from '@mastra/factory/work-items/change-requests';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { CARD_SOURCES } from '../cardSources';
import { CHANGE_REQUEST_TERMS, changeRequestStatus } from '../changeRequestState';
import { changeRequestLinkLabel, changeRequestRepository } from '../sessionChangeRequests';
import { workItemIdentifier, workItemShortReference } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { RELATED_ITEM_LINK_CLASS } from './RelatedWorkItemLink';

interface UpstreamLink {
  url: string;
  label: string;
  ariaLabel: string;
  icon: ReactNode;
}

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
  return upstreamLinks(item, shownAsRelated, short).map(link => (
    <a
      key={link.url}
      href={link.url}
      target="_blank"
      rel="noreferrer"
      draggable={false}
      aria-label={link.ariaLabel}
      className={cn('text-muted-foreground', RELATED_ITEM_LINK_CLASS)}
    >
      {link.icon}
      <Txt as="span" variant="meta" className="min-w-0 truncate">
        {link.label}
      </Txt>
    </a>
  ));
}
