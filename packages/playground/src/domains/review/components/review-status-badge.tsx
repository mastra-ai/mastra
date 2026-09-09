import { Badge } from '@mastra/playground-ui/components/Badge';
import type { ComponentProps, ReactNode } from 'react';

type ReviewStatus = 'needs-review' | 'complete' | 'reviewed';

function reviewStatusBadgeVariant(status: string): ComponentProps<typeof Badge>['variant'] {
  if (status === 'needs-review') return 'orange';
  if (status === 'complete' || status === 'reviewed') return 'green';
  return 'neutral';
}

type ReviewStatusBadgeProps = Omit<ComponentProps<typeof Badge>, 'variant' | 'children'> & {
  status: ReviewStatus | (string & {});
  children?: ReactNode;
};

/** Shared status badge for review items and trace feedback, so both surfaces use the same colours. */
export function ReviewStatusBadge({ status, children, ...props }: ReviewStatusBadgeProps) {
  return (
    <Badge size="xs" {...props} variant={reviewStatusBadgeVariant(status)}>
      {children ?? status}
    </Badge>
  );
}
