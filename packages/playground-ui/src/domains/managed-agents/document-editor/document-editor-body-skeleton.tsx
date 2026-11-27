import { Skeleton } from '@/ds/components/Skeleton';

export function DocumentEditorBodySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
