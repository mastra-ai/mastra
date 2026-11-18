import { Field } from '@mastra/playground-ui/components/Field';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

function DescriptionPlaceholder({ width }: { width: string }) {
  return (
    <div className="-mt-1">
      <SkeletonText line="text-caption" className={cn(width, 'max-w-full motion-reduce:before:animate-none')} />
    </div>
  );
}

export function NewBoardFormSkeleton() {
  return (
    <div role="status" aria-label="Loading new board form">
      <div aria-hidden className="flex flex-col gap-6">
        <Field>
          <SkeletonText line="text-label" className="w-24 motion-reduce:before:animate-none" />
          <Skeleton className="h-control-md w-full rounded-full motion-reduce:before:animate-none" />
        </Field>
        <Field>
          <SkeletonText line="text-label" className="w-20 motion-reduce:before:animate-none" />
          <Skeleton className="h-control-md w-full rounded-full motion-reduce:before:animate-none" />
          <DescriptionPlaceholder width="w-80" />
        </Field>
        <Field>
          <SkeletonText line="text-label" className="w-20 motion-reduce:before:animate-none" />
          <Skeleton className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
          <DescriptionPlaceholder width="w-72" />
        </Field>
        <Notice variant="info">
          <span className="flex flex-col">
            <SkeletonText line="text-body-sm" className="w-full motion-reduce:before:animate-none" />
            <SkeletonText line="text-body-sm" className="w-1/3 motion-reduce:before:animate-none" />
          </span>
        </Notice>
        <div className="flex justify-end gap-2">
          <Skeleton className="h-control-md w-17 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="h-control-md w-26 rounded-full motion-reduce:before:animate-none" />
        </div>
      </div>
    </div>
  );
}
