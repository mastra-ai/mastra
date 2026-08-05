import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

interface TwoPanePickerSkeletonProps {
  testId: string;
}

export const TwoPanePickerSkeleton = ({ testId }: TwoPanePickerSkeletonProps) => (
  <div className="h-full min-h-0 overflow-hidden">
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] overflow-hidden" data-testid={testId}>
      <div className="border-border1 flex h-full min-h-0 flex-col gap-3 border-r px-6 py-6">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-full rounded-md" />
        <Skeleton className="h-7 w-full rounded-md" />
        <Skeleton className="h-7 w-full rounded-md" />
        <Skeleton className="h-7 w-full rounded-md" />
      </div>

      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 px-6 py-6">
        <div className="max-w-[30ch] shrink-0">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <div className="grid grid-cols-1 content-start gap-2 sm:grid-cols-2 lg:gap-6 2xl:grid-cols-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
