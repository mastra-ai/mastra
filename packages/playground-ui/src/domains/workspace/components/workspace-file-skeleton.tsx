import { Skeleton } from '@/ds/components/Skeleton/skeleton';

export function WorkspaceFileSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2 p-4">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
