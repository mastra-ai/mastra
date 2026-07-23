import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';

export function ChatHeader({ mobileContent }: { mobileContent?: ReactNode }) {
  const { desktopState } = useMainSidebar();

  return (
    <>
      <header className="flex items-center gap-2 px-3 py-2 md:hidden">
        <MainSidebar.MobileTrigger id="mobile-navigation-trigger" />
        {mobileContent}
      </header>
      {desktopState === 'collapsed' && (
        <header className="hidden shrink-0 items-center px-3 py-2 md:flex">
          <MainSidebar.Trigger className="mx-0" />
        </header>
      )}
    </>
  );
}
