import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import type { ReactNode } from 'react';
import { SidebarPanel } from './sidebar-panel';

export function AgentSidebarLoadingSkeleton() {
  return (
    <SidebarPanel>
      <div className="min-h-0 flex-1 p-1" data-testid="agent-route-sidebar-skeleton">
        <div className="flex h-full w-full flex-col">
          <SidebarLoadingRow>
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-3 w-16" />
          </SidebarLoadingRow>
          <hr aria-hidden="true" className="bg-border/40 -mx-1 my-1 h-px border-0" />
          <div className="flex flex-col gap-px">
            <SidebarLoadingRow>
              <Skeleton className="h-3 w-32" />
            </SidebarLoadingRow>
            <SidebarLoadingRow>
              <Skeleton className="h-3 w-24" />
            </SidebarLoadingRow>
            <SidebarLoadingRow>
              <Skeleton className="h-3 w-36" />
            </SidebarLoadingRow>
            <SidebarLoadingRow>
              <Skeleton className="h-3 w-28" />
            </SidebarLoadingRow>
          </div>
        </div>
      </div>

      <div className="rounded-studio-panel border-border/40 bg-muted m-2 border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
      </div>
    </SidebarPanel>
  );
}

function SidebarLoadingRow({ children }: { children: ReactNode }) {
  return <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-xl px-3">{children}</div>;
}

export function ChatMessagesLoadingSkeleton() {
  return (
    <div className="min-h-0 space-y-4 overflow-hidden pt-4">
      <div className="flex justify-start">
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-3/5 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <div className="w-4/5 space-y-2">
          <Skeleton className="h-4 w-full rounded-full" />
          <Skeleton className="h-4 w-5/6 rounded-full" />
          <Skeleton className="h-4 w-2/3 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function AgentChatLoadingSkeleton() {
  return (
    <div className="grid h-full min-h-0 w-full overflow-hidden px-4 py-4 md:px-10">
      <div className="mx-auto grid h-full min-h-0 w-full max-w-[80ch] grid-rows-[1fr_auto]">
        <ChatMessagesLoadingSkeleton />

        <div className="border-border bg-background rounded-3xl border px-3 py-2.5">
          <Skeleton className="h-5 w-1/2 rounded-full" />
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
