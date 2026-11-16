import type { PullRequestStatus } from '@mastra/factory/work-items/change-requests';
import { PullRequestIcon } from '@mastra/playground-ui/components/PullRequestIcon';

import { CHANGE_REQUEST_TERMS, changeRequestStatusLabel } from '../changeRequestState';
import type { ChangeRequestProvider } from '../services/githubSubscriptions';

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
