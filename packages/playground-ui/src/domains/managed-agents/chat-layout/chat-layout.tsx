import { ChatLayoutDetails } from './chat-layout-details';
import { ChatLayoutThreads } from './chat-layout-threads';
import type { ChatLayoutProps } from './chat-layout-types';
import { useChatLayoutShortcuts } from './use-chat-layout-shortcuts';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';

export function ChatLayout({
  threads,
  threadsOpen: threadsOpenProp,
  onThreadsOpenChange,
  details,
  detailsOpen,
  onDetailsOpenChange,
  children,
}: ChatLayoutProps) {
  const mobile = useIsMobile();
  const threadsOpen = threadsOpenProp ?? !mobile;
  useChatLayoutShortcuts({ threads, threadsOpen, onThreadsOpenChange, details, detailsOpen, onDetailsOpenChange });

  // One shell for both breakpoints keeps the conversation mounted when only the panels move into drawers.
  return (
    <div data-slot="chat-layout" className={cn('flex h-full min-h-0', mobile ? 'relative flex-col' : 'p-2')}>
      {threads ? (
        <ChatLayoutThreads mobile={mobile} open={threadsOpen} onOpenChange={onThreadsOpenChange ?? (() => undefined)}>
          {threads}
        </ChatLayoutThreads>
      ) : null}
      <div data-slot="chat-layout-main" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
      {details ? (
        <ChatLayoutDetails mobile={mobile} open={detailsOpen} onOpenChange={onDetailsOpenChange}>
          {details}
        </ChatLayoutDetails>
      ) : null}
    </div>
  );
}
