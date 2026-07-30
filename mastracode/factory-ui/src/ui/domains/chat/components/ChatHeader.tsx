import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ChatHeaderProps = ComponentPropsWithoutRef<'header'> & {
  mobileContent?: ReactNode;
};

/** The single header bar of a page. Renders nothing when it would hold neither a trigger nor content. */
export function ChatHeader({ mobileContent, children, className, ...props }: ChatHeaderProps) {
  // both triggers off one signal — px matchMedia vs rem `md:` drifts into two toggles or none
  const { isMobile, desktopState } = useMainSidebar();

  const trigger = isMobile ? (
    <MainSidebar.MobileTrigger id="mobile-navigation-trigger" />
  ) : desktopState === 'collapsed' ? (
    <MainSidebar.Trigger className="mx-0 shrink-0" />
  ) : null;
  const content = isMobile ? mobileContent : null;

  if (!trigger && !content && !children) return null;

  return (
    <header className={cn('flex min-w-0 shrink-0 items-center gap-2 px-3 py-2', className)} {...props}>
      {trigger}
      {content}
      {children}
    </header>
  );
}
