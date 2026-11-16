import { Badge } from '@mastra/playground-ui/components/Badge';
import { cn } from '@mastra/playground-ui/utils/cn';

import { sourceState } from '../services/workItemPresentation';
import type { WorkItem } from '../services/workItems';

export function SourceStateBadge({
  item,
  className,
}: {
  item: Pick<WorkItem, 'source' | 'workItem'>;
  className?: string;
}) {
  const state = sourceState(item);
  if (!state) return null;
  return (
    <Badge size="xs" variant="neutral" className={cn('shrink-0', className)} aria-label={`Source state: ${state}`}>
      {state}
    </Badge>
  );
}
