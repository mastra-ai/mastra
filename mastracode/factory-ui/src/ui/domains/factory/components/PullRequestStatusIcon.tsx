import { PullRequestIcon } from '@mastra/playground-ui/components/PullRequestIcon';

import { PULL_REQUEST_STATUS_LABELS } from '../boardItems';
import type { PullRequestStatus } from '../boardItems';

export function PullRequestStatusIcon({
  status,
  size = 16,
  className,
  decorative,
}: {
  status: PullRequestStatus;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const label = PULL_REQUEST_STATUS_LABELS[status];
  return (
    <PullRequestIcon
      status={status}
      size={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    />
  );
}
