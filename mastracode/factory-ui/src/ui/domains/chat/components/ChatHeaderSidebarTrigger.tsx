import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';

/** Opens the navigation drawer on mobile, or reopens the collapsed sidebar on desktop. */
export function ChatHeaderSidebarTrigger() {
  const { isMobile, desktopState } = useSidebar();
  if (isMobile) return <Sidebar.MobileTrigger id="mobile-navigation-trigger" className="shrink-0" />;
  if (desktopState === 'collapsed') return <Sidebar.Trigger className="shrink-0" />;
  return null;
}
