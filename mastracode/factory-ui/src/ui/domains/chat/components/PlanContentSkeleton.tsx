import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

const BODY_LINES = ['w-full', 'w-11/12', 'w-full', 'w-3/5'];

const barClass = 'max-w-full motion-reduce:before:animate-none';

export function PlanContentSkeleton() {
  return (
    <div role="status" aria-label="Loading plan" className="flex flex-col gap-2">
      <div aria-hidden className="contents">
        <SkeletonText line="text-heading" className={cn(barClass, 'w-1/3')} />
        <div className="flex flex-col">
          {BODY_LINES.map((width, line) => (
            <SkeletonText key={line} line="text-body" className={cn(barClass, width)} />
          ))}
        </div>
      </div>
    </div>
  );
}
