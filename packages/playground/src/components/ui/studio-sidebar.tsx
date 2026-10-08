import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { AppSidebar } from './app-sidebar';
import { StudioRail } from './studio-rail';

/** Mobile keeps the full navigation drawer; desktop uses the fixed icon rail. */
export function StudioSidebar() {
  const { isMobile } = useSidebar();
  if (isMobile) return <AppSidebar />;
  return <StudioRail />;
}
