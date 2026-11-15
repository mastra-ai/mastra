import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowUpRight } from 'lucide-react';

import { changeRequestSource } from '../changeRequestState';
import {
  changeRequestLinkLabel,
  changeRequestNumberLabel,
  changeRequestReference,
  changeRequestRepository,
} from '../sessionChangeRequests';
import type { SessionChangeRequest } from '../sessionChangeRequests';
import { repositoryElsewhere } from '../services/relationships';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

const outboundArrowClass =
  'text-muted-foreground ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/outbound:opacity-100 group-focus-visible/outbound:opacity-100';

export function ChangeRequestLink({
  request,
  sessionRepository,
}: {
  request: SessionChangeRequest;
  sessionRepository: string | undefined;
}) {
  const reference = changeRequestReference(request, sessionRepository);
  const elsewhere = repositoryElsewhere(changeRequestRepository(request.url), sessionRepository);
  return (
    <Button
      render={<a href={request.url} target="_blank" rel="noreferrer" />}
      variant="ghost"
      size="sm"
      className="group/outbound w-full justify-start"
      aria-label={changeRequestLinkLabel(reference, request.status)}
    >
      {request.status ? (
        <PullRequestStatusIcon status={request.status} provider={request.provider} size={14} decorative />
      ) : (
        <SourceIcon source={changeRequestSource(request.provider)} className="size-3.5" />
      )}
      <span className="shrink-0">{changeRequestNumberLabel(request) ?? reference}</span>
      {elsewhere ? (
        <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
          {elsewhere.split('/').at(-1)}
        </Txt>
      ) : null}
      <ArrowUpRight aria-hidden className={outboundArrowClass} />
    </Button>
  );
}
