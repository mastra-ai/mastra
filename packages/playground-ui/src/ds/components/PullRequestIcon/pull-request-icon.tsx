import { GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import './pull-request-icon.css';

const statuses = {
  draft: { icon: GitPullRequestDraft, className: 'text-icon3!' },
  open: { icon: GitPullRequest, className: 'text-accent1!' },
  closed: { icon: GitPullRequestClosed, className: 'text-error!' },
  merged: { icon: GitPullRequest, className: 'pull-request-icon-merged' },
};

export interface PullRequestIconProps extends ComponentProps<'svg'> {
  status: keyof typeof statuses;
  size?: number;
}

export function PullRequestIcon({ status, size = 16, className, ...props }: PullRequestIconProps) {
  const { icon: Icon, className: statusClassName } = statuses[status];
  return <Icon size={size} className={cn('shrink-0', statusClassName, className)} {...props} />;
}
