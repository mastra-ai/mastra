import type { PullRequestStatus } from '@mastra/client-js';
import { CHANGE_REQUEST_TERMS, changeRequestStatusLabel } from './change-request-state';

import type { ChangeRequestProvider } from './change-request-state';
import { PullRequestIcon } from '@/ds/components/PullRequestIcon';

export function PullRequestStatusIcon({
  status,
  provider = 'github',
  size = 16,
  className,
  decorative,
}: {
  status: PullRequestStatus;
  provider?: ChangeRequestProvider;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <PullRequestIcon
      data-source={CHANGE_REQUEST_TERMS[provider].source}
      status={status}
      size={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : changeRequestStatusLabel(provider, status)}
      aria-hidden={decorative || undefined}
    />
  );
}
