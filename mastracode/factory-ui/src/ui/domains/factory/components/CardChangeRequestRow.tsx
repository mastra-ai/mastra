import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';

import { changeRequestSource } from '../changeRequestState';
import { changeRequestLinkLabel } from '../sessionChangeRequests';
import type { SessionChangeRequest } from '../sessionChangeRequests';
import { workItemReferenceLabel } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

export function CardChangeRequestRow({
  item,
  request,
  repository,
}: {
  item: WorkItem;
  request: SessionChangeRequest;
  repository: string | undefined;
}) {
  const reference = workItemReferenceLabel(item, repository);
  return (
    <Button
      render={<a href={request.url} target="_blank" rel="noreferrer" />}
      variant="ghost"
      size="sm"
      className="w-full min-w-0 justify-start"
      aria-label={changeRequestLinkLabel(reference, request.status)}
    >
      {request.status ? (
        <PullRequestStatusIcon status={request.status} provider={request.provider} size={14} decorative />
      ) : (
        <SourceIcon source={changeRequestSource(request.provider)} className="size-3.5" />
      )}
      <span className="truncate">{reference}</span>
      <IconArrowUpRight aria-hidden className="ml-auto" />
    </Button>
  );
}
