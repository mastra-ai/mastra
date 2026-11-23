import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { cn } from '@mastra/playground-ui/utils/cn';

/** Reopens the collapsed sidebar on desktop. */
export function ChatHeaderSidebarTrigger({ className }: { className?: string }) {
  const { isMobile, desktopState } = useSidebar();
  if (!isMobile && desktopState === 'collapsed') return <Sidebar.Trigger className={cn('shrink-0', className)} />;
  return null;
}
