import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';

export function ChatHeaderSidebarTrigger({
  isMobile,
  sidebarCollapsed,
}: {
  isMobile: boolean;
  sidebarCollapsed: boolean;
}) {
  if (isMobile) return <MainSidebar.MobileTrigger id="mobile-navigation-trigger" />;
  if (sidebarCollapsed) return <MainSidebar.Trigger className="mx-0 shrink-0" />;
  return null;
}
