import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';

import { PageLayoutMobileHeader } from '../../../ui/PageLayout';

export function ChatHeader() {
  const { desktopState, isMobile } = useMainSidebar();

  if (isMobile) {
    return (
      <header className="flex items-center gap-2 px-3 py-2">
        <MainSidebar.MobileTrigger id="mobile-navigation-trigger" />
        <PageLayoutMobileHeader />
      </header>
    );
  }

  if (desktopState !== 'collapsed') return null;

  return (
    <header className="flex shrink-0 items-center px-3 py-2">
      <MainSidebar.Trigger className="mx-0" />
    </header>
  );
}
