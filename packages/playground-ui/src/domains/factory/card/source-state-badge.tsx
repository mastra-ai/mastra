import type { WorkItem } from '@internal/factory-contract';

import { SourceStateBadge as SharedSourceStateBadge } from '../board';
import { sourceState } from './work-item-presentation';

export function WorkItemSourceStateBadge({
  item,
  className,
}: {
  item: Pick<WorkItem, 'source' | 'workItem'>;
  className?: string;
}) {
  return <SharedSourceStateBadge state={sourceState(item)} className={className} />;
}
