import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { ListHeading } from '../ListHeading';
import {
  PACK_CARD_CLASS,
  PACK_FALLBACK_CLASS,
  PACK_HEADER_CLASS,
  PACK_LIST_CLASS,
  PACK_MODEL_ROW_CLASS,
} from './packLayout';

const bar = 'motion-reduce:before:animate-none';

function ModelRow() {
  return (
    <div className={PACK_MODEL_ROW_CLASS}>
      <Skeleton className={cn('size-icon-md shrink-0 rounded-sm', bar)} />
      <SkeletonText line="text-label" className={cn('w-36', bar)} />
    </div>
  );
}

export function ModelPackListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className={PACK_LIST_CLASS}>
      <ListHeading label="Model packs" />
      <div aria-hidden className={PACK_CARD_CLASS}>
        <div className={PACK_HEADER_CLASS}>
          <SkeletonText line="text-caption px-3 py-1" className={cn('w-14', bar)} />
        </div>
        <ModelRow />
        <div className={PACK_FALLBACK_CLASS}>
          <ModelRow />
        </div>
      </div>
    </div>
  );
}
