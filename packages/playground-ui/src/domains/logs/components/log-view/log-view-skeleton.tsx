import { LogViewFill } from './log-view-fill';
import { SkeletonText } from '@/ds/components/Skeleton';

const SKELETON_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5', 'w-4/5'] as const;

export function LogViewSkeleton() {
  return (
    <LogViewFill>
      <div className="flex flex-col gap-1 px-3 py-2" aria-busy="true">
        {SKELETON_WIDTHS.map(width => (
          <SkeletonText key={width} className={width} />
        ))}
      </div>
    </LogViewFill>
  );
}
