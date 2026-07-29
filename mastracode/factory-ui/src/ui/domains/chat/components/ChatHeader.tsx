import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ChatHeaderProps = ComponentPropsWithoutRef<'header'> & {
  /** Rendered on mobile only — pages gate it on their own viewport check. */
  mobileContent?: ReactNode;
};

/**
 * The one header bar of a page: the sidebar trigger for the current viewport
 * plus optional page content. Contentless chrome collapses away, so an expanded
 * desktop sidebar (which carries its own toggle) leaves no dead bar behind.
 */
export function ChatHeader({ mobileContent, children, className, ...props }: ChatHeaderProps) {
  // Both triggers off the same `isMobile`, never a `md:` media query: the
  // provider's breakpoint is px and `md:` is rem, so a moved rem base would
  // open a band with two toggles or none.
  const { isMobile, desktopState } = useMainSidebar();
  const trigger = isMobile ? (
    <MainSidebar.MobileTrigger id="mobile-navigation-trigger" />
  ) : desktopState === 'collapsed' ? (
    <MainSidebar.Trigger className="mx-0 shrink-0" />
  ) : null;

  if (!trigger && !mobileContent && !children) return null;

  return (
    <header className={cn('flex min-w-0 shrink-0 items-center gap-2 px-3 py-2', className)} {...props}>
      {trigger}
      {mobileContent}
      {children}
    </header>
  );
}
