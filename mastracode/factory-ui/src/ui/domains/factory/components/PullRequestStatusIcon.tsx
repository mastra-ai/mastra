import { PullRequestIcon } from '@mastra/playground-ui/components/PullRequestIcon';

import type { PullRequestStatus } from '../boardItems';
import { CHANGE_REQUEST_STATUS_LABELS } from '../changeRequestState';
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
      data-source={provider === 'gitlab' ? 'gitlab-pr' : 'github-pr'}
      status={status}
      size={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : CHANGE_REQUEST_STATUS_LABELS[provider][status]}
      aria-hidden={decorative || undefined}
    />
  );
}
