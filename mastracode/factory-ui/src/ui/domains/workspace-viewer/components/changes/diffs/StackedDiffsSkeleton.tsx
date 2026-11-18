import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

const FILES = [
  { path: 'w-40', lines: ['w-3/4', 'w-1/2', 'w-5/6', 'w-2/3', 'w-1/3'] },
  { path: 'w-56', lines: ['w-2/3', 'w-5/6', 'w-1/2'] },
  { path: 'w-32', lines: ['w-5/6', 'w-3/5', 'w-3/4', 'w-1/2'] },
];

const barClass = 'max-w-full motion-reduce:before:animate-none';

export function StackedDiffsSkeleton() {
  return (
    <div role="status" aria-label="Loading changes" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {FILES.map(({ path, lines }) => (
        <div key={path} aria-hidden className="border-border bg-card border-b">
          <div className="flex items-start gap-2 py-2 pr-3 pl-2">
            <span className="flex h-5 shrink-0 items-center gap-1.5">
              <span className="size-icon-md" />
              <Skeleton className={cn('size-icon-md rounded-sm', barClass)} />
            </span>
            <SkeletonText className={cn(path, barClass)} />
            <span className="ml-auto flex h-5 items-center">
              <Skeleton className={cn('h-3 w-12', barClass)} />
            </span>
          </div>
          <div className="flex flex-col p-3">
            {lines.map((width, line) => (
              <SkeletonText key={line} line="text-caption" className={cn('h-3', width, barClass)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
