import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
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
        <ComposerLoadingSkeleton />
      </div>
    </div>
  );
}

export function ComposerLoadingSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-background px-3 py-2.5">
      <Skeleton className="h-5 w-1/2 rounded-full" />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-control-md w-24 rounded-full" />
        <Skeleton className="h-control-md w-control-md rounded-full" />
      </div>
    </div>
  );
}

// Mirrors the /new landing silhouette (greeting, centered composer, prompt cards) so the
// page resolves in place instead of jumping from a docked-chat skeleton.
export function AgentLandingLoadingSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col items-center justify-center px-4 py-4 md:px-10"
      data-testid="agent-landing-skeleton"
      aria-busy="true"
    >
      <div className="flex w-full max-w-[80ch] flex-col gap-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-avatar-lg w-avatar-lg rounded-full" />
          <Skeleton className="h-7 w-2/3 rounded-full" />
        </div>
        <ComposerLoadingSkeleton />
        <div className="flex flex-col gap-1 px-3">
          <Skeleton className="h-control-md w-2/3 rounded-full" />
          <Skeleton className="h-control-md w-1/2 rounded-full" />
          <Skeleton className="h-control-md w-3/5 rounded-full" />
        </div>
      </div>
    </div>
  );
}
