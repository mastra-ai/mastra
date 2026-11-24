import type { PullRequestStatus } from '@mastra/factory/work-items/change-requests';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { textStyle } from '@mastra/playground-ui/primitives/text';
import { cn } from '@mastra/playground-ui/utils/cn';

import { changeRequestLinkLabel, changeRequestNumberLabel, changeRequestReference } from '../sessionChangeRequests';
import type { SessionChangeRequest } from '../sessionChangeRequests';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';

const STATUS_TONES: Record<PullRequestStatus, string> = {
  open: 'bg-badge-green-subtle text-badge-green-foreground',
  merged: 'bg-badge-purple-subtle text-badge-purple-foreground',
  closed: 'bg-badge-red-subtle text-badge-red-foreground',
  draft: 'bg-fill text-foreground',
};

/** The card's own pull request, as a chip on the line where its branch meets the base. */
export function ChangeRequestBadge({
  request,
  sessionRepository,
}: {
  request: SessionChangeRequest;
  sessionRepository: string | undefined;
}) {
  const reference = changeRequestReference(request, sessionRepository);
  return (
    <a
      href={request.url}
      target="_blank"
      rel="noreferrer"
      aria-label={changeRequestLinkLabel(reference, request.status)}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-[7px] pr-2 pl-1.5 tabular-nums transition-[filter] duration-150 hover:brightness-125 motion-reduce:transition-none',
        textStyle({ variant: 'caption' }),
        STATUS_TONES[request.status ?? 'draft'],
        focusRing,
      )}
    >
      {request.status ? (
        <PullRequestStatusIcon status={request.status} provider={request.provider} size={14} decorative />
      ) : null}
      {changeRequestNumberLabel(request) ?? reference}
    </a>
  );
}
