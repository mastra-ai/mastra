import {
  CHANGE_REQUEST_TERMS,
  changeRequestLinkLabel,
  changeRequestNumberLabel,
  changeRequestReference,
  changeRequestRepository,
  repositoryElsewhere,
  SourceIcon,
  PullRequestStatusIcon,
  outboundArrowClass,
} from '..';
import type { SessionChangeRequest } from '..';
import { Button } from '@/ds/components/Button';

import { Txt } from '@/ds/components/Txt';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';

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
      iconEnd={<IconArrowUpRight className={outboundArrowClass} />}
      icon={
        request.status ? (
          <PullRequestStatusIcon status={request.status} provider={request.provider} size={14} decorative />
        ) : (
          <SourceIcon source={CHANGE_REQUEST_TERMS[request.provider].source} />
        )
      }
      render={<a href={request.url} target="_blank" rel="noreferrer" />}
      variant="ghost"
      size="sm"
      className="group/outbound w-full min-w-0 justify-start"
      aria-label={changeRequestLinkLabel(reference, request.status)}
    >
      <span className={label === 'number' ? 'shrink-0' : 'min-w-0 truncate'}>
        {label === 'number' ? (changeRequestNumberLabel(request) ?? reference) : reference}
      </span>
      {elsewhere ? (
        <Txt as="span" variant="caption" tone="muted" className="min-w-0 truncate">
          {elsewhere.split('/').at(-1)}
        </Txt>
      ) : null}
    </Button>
  );
}
