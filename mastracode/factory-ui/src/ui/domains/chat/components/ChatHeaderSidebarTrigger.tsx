import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';

/** Opens the navigation drawer on mobile, or reopens the collapsed sidebar on desktop. */
export function ChatHeaderSidebarTrigger({ className }: { className?: string }) {
  const { isMobile, desktopState } = useSidebar();
  if (isMobile) return <Sidebar.MobileTrigger id="mobile-navigation-trigger" className={cn('shrink-0', className)} />;
  if (desktopState === 'collapsed') return <Sidebar.Trigger className={cn('shrink-0', className)} />;
  return null;
}
