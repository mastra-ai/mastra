import { SourceStateBadge as SharedSourceStateBadge } from '@mastra/playground-ui/domains/factory';

import { sourceState } from '../services/workItemPresentation';
import type { WorkItem } from '../services/workItems';

export function SourceStateBadge({
  item,
  className,
}: {
  item: Pick<WorkItem, 'source' | 'workItem'>;
  className?: string;
}) {
  return <SharedSourceStateBadge state={sourceState(item)} className={className} />;
}
