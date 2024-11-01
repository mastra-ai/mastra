import { Skeleton } from '@/components/ui/skeleton';

const WorkflowHeaderLoader = () => {
  return (
    <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-zinc-600 px-[20px]">
      <div className="inline-flex h-[26px] items-center justify-start gap-3">
        <Skeleton className="h-full w-[6rem]" />
        <Skeleton className="h-full w-[6rem]" />
      </div>

      <Skeleton className="h-[26px] w-[8rem]" />
    </div>
  );
};

export default WorkflowHeaderLoader;
