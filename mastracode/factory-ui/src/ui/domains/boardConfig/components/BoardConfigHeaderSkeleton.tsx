import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

export function BoardConfigHeaderSkeleton({ phase }: { phase: boolean }) {
  return (
    <div role="status" aria-label={phase ? 'Loading phase name' : 'Loading board name'}>
      <PageHeader aria-hidden>
        <PageHeader.Title className="gap-2.5">
          {phase && <Skeleton className="size-4 shrink-0 rounded-full motion-reduce:before:animate-none" />}
          <SkeletonText
            line="text-heading"
            className={cn(phase ? 'w-18' : 'w-40', 'motion-reduce:before:animate-none')}
          />
        </PageHeader.Title>
        {phase && (
          <PageHeader.Meta beside>
            <Skeleton className="h-5 w-16 rounded-full motion-reduce:before:animate-none" />
          </PageHeader.Meta>
        )}
        <PageHeader.Description>
          <SkeletonText line="text-caption" className="w-72 max-w-full motion-reduce:before:animate-none" />
        </PageHeader.Description>
        {!phase && (
          <PageHeader.Action>
            <Skeleton className="h-control-sm w-20 rounded-full motion-reduce:before:animate-none" />
          </PageHeader.Action>
        )}
      </PageHeader>
    </div>
  );
}
