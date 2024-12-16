import { Skeleton } from '@/components/ui/skeleton';

import { cn } from '@/lib/utils';

export const WorkflowLoader = () => {
  return (
    <section className="bg-mastra-bg-1 flex h-full w-full overflow-hidden">
      <div className="relative grow bg-[url(/images/workflow-bg.svg)]">
        <div className="mb-24 h-full p-5">
          <div className={`flex h-full min-w-min flex-col items-center justify-center`}>
            <div className="bg-mastra-bg-8 border-border w-[274px] rounded-[0.3125rem] border-[0.5px] border-solid">
              <div className="flex items-center gap-3 p-3">
                <Skeleton className="h-[33px] w-[33px] rounded-sm" />
                <Skeleton className="h-[16px] w-[89px]" />
              </div>
            </div>
            <div
              role="presentation"
              className={cn('from-accent to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-t')}
            />
            <Skeleton className="h-6 w-6 rounded-full" />
            <div
              role="presentation"
              className={cn('from-mastra-el-2 to-mastra-bg-1 relative h-[30px] w-[1px] bg-gradient-to-b')}
            />
            <div className="bg-mastra-bg-8 border-border w-[274px] rounded-[0.3125rem] border-[0.5px] border-solid">
              <div className="flex items-center gap-3 p-3">
                <Skeleton className="h-[33px] w-[33px] rounded-sm" />
                <Skeleton className="h-[16px] w-[89px]" />
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-5 left-1/2 flex w-full -translate-x-1/2 justify-center gap-2">
            <div className="shadow-main pointer-events-auto flex items-center gap-x-2 rounded-lg bg-[#282828]/30 p-2 backdrop-blur">
              <Skeleton className="h-[33px] w-[97px]" />
              <Skeleton className="h-[33px] w-[33px]" />
            </div>
            <div className="shadow-main pointer-events-auto flex items-center gap-x-[0.88rem] rounded-lg bg-[#282828]/30 p-2 backdrop-blur">
              <Skeleton className="h-[16px] w-[196px]" />
              <Skeleton className="h-[28px] w-[65px]" />
            </div>
          </div>
        </div>
      </div>

      <aside className="border-border bg-mastra-bg-2 m-2 w-[24rem] shrink-0 rounded-[0.3125rem] border-[0.5px]">
        <div className="flex flex-col gap-6">
          <div className="border-border flex flex-col gap-3 border-b-[0.3px] p-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-[33px] w-[33px] rounded-sm" />
              <Skeleton className="h-[13px] w-[89px]" />
            </div>
            <Skeleton className="h-3 w-[250px]" />
            <Skeleton className="h-3 w-[250px]" />
            <Skeleton className="h-3 w-[250px]" />
            <Skeleton className="h-3 w-[250px]" />
          </div>
          <div className="flex-col p-6">
            <div className="flex items-center">
              <div className="w-[120px]">
                <Skeleton className="h-3 w-[50px]" />
              </div>
              <div className="flex items-center gap-[6px]">
                <Skeleton className="h-[18px] w-[18px] rounded-full" />
                <Skeleton className="h-[16px] w-[46px]" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
};
