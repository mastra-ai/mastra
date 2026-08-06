import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { GlobalSearchButton } from '../../search/components/GlobalSearchButton';
import { ChatHeaderSidebarTrigger } from './ChatHeaderSidebarTrigger';

type ChatHeaderProps = ComponentPropsWithoutRef<'header'> & {
  mobileContent?: ReactNode;
};

function searchTriggerId(isMobile: boolean): string {
  if (isMobile) return 'global-search-mobile-trigger';
  return 'global-search-collapsed-trigger';
}

export function ChatHeader({ mobileContent, children, className, ...props }: ChatHeaderProps) {
  // DS media signal for both — px matchMedia against rem breakpoints desyncs into two controls or none
  const { isMobile, desktopState } = useMainSidebar();
  const sidebarCollapsed = desktopState === 'collapsed';
  const showHeaderControls = isMobile || sidebarCollapsed;
  const content = isMobile ? mobileContent : undefined;

  if (!showHeaderControls && !content && !children) return null;

  return (
    <header className={cn('flex min-w-0 shrink-0 items-center gap-2 px-3 py-2', className)} {...props}>
      <ChatHeaderSidebarTrigger isMobile={isMobile} sidebarCollapsed={sidebarCollapsed} />
      {content}
      {children}
      {showHeaderControls && (
        <div className="ml-auto shrink-0">
          <GlobalSearchButton id={searchTriggerId(isMobile)} />
        </div>
      )}
    </header>
  );
}
