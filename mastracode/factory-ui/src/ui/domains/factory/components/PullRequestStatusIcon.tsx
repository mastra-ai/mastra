import { cn } from '@mastra/playground-ui/utils/cn';
import type { LucideIcon } from 'lucide-react';
import { GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from 'lucide-react';

import type { PullRequestStatus } from '../boardItems';

// Colors are `!` so a container's icon styling (sidebar rows tint every svg) can't strip the status meaning
const STATUS_PRESENTATION: Record<PullRequestStatus, { icon: LucideIcon; className: string; label: string }> = {
  draft: {
    icon: GitPullRequestDraft,
    className: 'text-icon3!',
    label: 'Draft pull request',
  },
  open: {
    icon: GitPullRequest,
    className: 'text-accent1!',
    label: 'Open pull request',
  },
  closed: {
    icon: GitPullRequestClosed,
    className: 'text-error!',
    label: 'Closed pull request',
  },
  merged: {
    icon: GitPullRequest,
    className: 'text-pr-merged!',
    label: 'Merged pull request',
  },
};

export function PullRequestStatusIcon({
  status,
  size = 16,
  className,
  decorative,
}: {
  status: PullRequestStatus;
  size?: number;
  className?: string;
  /** Set when an ancestor already names the icon (labelled button, `role="img"` wrapper, sr-only row label). */
  decorative?: boolean;
}) {
  const { icon: Icon, className: statusClassName, label } = STATUS_PRESENTATION[status];
  return (
    <Icon
      size={size}
      className={cn('shrink-0', statusClassName, className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    />
  );
}
