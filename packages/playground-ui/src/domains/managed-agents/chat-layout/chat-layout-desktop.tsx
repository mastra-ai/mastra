import { ChatLayoutSide } from './chat-layout-side';
import type { ChatLayoutProps } from './chat-layout-types';

export function ChatLayoutDesktop({
  threads,
  threadsOpen = true,
  details,
  detailsOpen,
  children,
}: Omit<ChatLayoutProps, 'onDetailsOpenChange' | 'onThreadsOpenChange'>) {
  return (
    <div data-slot="chat-layout" className="flex h-full min-h-0 p-2">
      {threads ? (
        <ChatLayoutSide side="start" open={threadsOpen}>
          <div className="flex w-65 flex-col overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--surface-rim)]">
            {threads}
          </div>
        </ChatLayoutSide>
      ) : null}
      <div data-slot="chat-layout-main" className="relative flex min-w-0 flex-1 flex-col">
        {children}
      </div>
      {details ? (
        <ChatLayoutSide side="end" open={detailsOpen}>
          {details}
        </ChatLayoutSide>
      ) : null}
    </div>
  );
}
