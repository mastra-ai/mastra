import { GitPullRequestDraft } from 'lucide-react';
import type { ComponentProps } from 'react';
import { IconPullRequest } from '@/ds/icons/central/IconPullRequest';
import { IconPullRequestClosedSimple } from '@/ds/icons/central/IconPullRequestClosedSimple';
import { cn } from '@/lib/utils';
import './pull-request-icon.css';

const statuses = {
  draft: { icon: GitPullRequestDraft, className: 'text-muted-foreground!' },
  open: { icon: IconPullRequest, className: 'text-success-indicator!' },
  closed: { icon: IconPullRequestClosedSimple, className: 'text-destructive-foreground!' },
  merged: { icon: IconPullRequest, className: 'pull-request-icon-merged' },
};

export interface PullRequestIconProps extends ComponentProps<'svg'> {
  status: keyof typeof statuses;
  size?: number;
}

export function PullRequestIcon({ status, size = 16, className, ...props }: PullRequestIconProps) {
  const { icon: Icon, className: statusClassName } = statuses[status];
  return <Icon size={size} className={cn('shrink-0', statusClassName, className)} {...props} />;
}
