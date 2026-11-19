import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';

import { CHANGE_REQUEST_TERMS } from '../changeRequestState';
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

export const outboundArrowClass =
  'text-muted-foreground ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover/outbound:opacity-100 group-focus-visible/outbound:opacity-100';

export function ChangeRequestLink({
  request,
  sessionRepository,
  label = 'number',
}: {
  request: SessionChangeRequest;
  sessionRepository: string | undefined;
  label?: 'number' | 'reference';
}) {
  const reference = changeRequestReference(request, sessionRepository);
  const elsewhere =
    label === 'number' ? repositoryElsewhere(changeRequestRepository(request.url), sessionRepository) : undefined;
  return (
    <Button
      render={<a href={request.url} target="_blank" rel="noreferrer" />}
      variant="ghost"
      size="sm"
      className="group/outbound w-full min-w-0 justify-start"
      aria-label={changeRequestLinkLabel(reference, request.status)}
    >
      {request.status ? (
        <PullRequestStatusIcon status={request.status} provider={request.provider} size={14} decorative />
      ) : (
        <SourceIcon source={CHANGE_REQUEST_TERMS[request.provider].source} className="size-3.5" />
      )}
      <span className={label === 'number' ? 'shrink-0' : 'min-w-0 truncate'}>
        {label === 'number' ? (changeRequestNumberLabel(request) ?? reference) : reference}
      </span>
      {elsewhere ? (
        <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
          {elsewhere.split('/').at(-1)}
        </Txt>
      ) : null}
      <IconArrowUpRight aria-hidden className={outboundArrowClass} />
    </Button>
  );
}
