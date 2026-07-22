import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';

/** Mobile-only chat header: exposes the design-system sidebar trigger. */
export function ChatHeader() {
  return (
    <header className="flex items-center gap-2 px-3 py-2 md:hidden">
      <MainSidebar.MobileTrigger id="mobile-navigation-trigger" />
    </header>
  );
}
