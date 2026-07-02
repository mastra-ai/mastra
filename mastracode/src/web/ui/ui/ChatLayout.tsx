import type { ReactNode } from 'react';

type ChatLayoutProps = {
  sidebar: ReactNode;
  content: ReactNode;
};

export function ChatLayout({ sidebar, content }: ChatLayoutProps) {
  return (
    <div className="relative z-1 flex h-screen gap-3 overflow-y-scroll bg-surface1 pb-3 pl-3 pt-3 md:gap-4 md:pb-4 md:pl-4 md:pt-4">
      <aside className="overflow-y-scroll md:relative md:z-40 md:block md:h-full md:w-64 md:shrink-0 md:rounded-lg md:border md:border-border1 md:bg-surface2 md:shadow-sm">
        {sidebar}
      </aside>
      <div className="relative z-1 flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">{content}</div>
    </div>
  );
}
