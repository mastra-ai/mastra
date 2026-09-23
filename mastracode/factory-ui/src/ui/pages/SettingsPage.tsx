import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SettingsLayout } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';

import { ChatHeaderSidebarTrigger } from '../domains/chat/components/ChatHeaderSidebarTrigger';
import { GlobalSearchButton } from '../domains/search/components/GlobalSearchButton';
import { SettingsHeader } from '../domains/settings/components/SettingsHeader';
import { SettingsPanel } from '../domains/settings/components/SettingsPanel';
import { isSettingsSection } from '../domains/settings/settingsSections';

/**
 * Routed settings page (`/settings/:section`). Sections are URL-addressable;
 * unknown sections redirect to the default. The app frame (sidebar swapped to
 * section navigation) is rendered by `AppLayout`.
 */
export function SettingsPage() {
  const { section } = useParams();
  const location = useLocation();

  if (!isSettingsSection(section)) {
    return <Navigate to="../preferences" replace state={location.state} />;
  }
  return (
    <SettingsPageLayout>
      <SettingsPanel />
    </SettingsPageLayout>
  );
}

/**
 * Settings body: on mobile the section title lives in the page header row
 * (the desktop title is rendered by the panel itself); with a collapsed
 * desktop sidebar the header row carries the sidebar trigger and search.
 */
export function SettingsPageLayout({ children }: { children: ReactNode }) {
  const { isMobile, desktopState } = useMainSidebar();
  const sidebarCollapsed = !isMobile && desktopState === 'collapsed';

  return (
    <PageLayout
      variant="fit"
      breadcrumbs={
        isMobile ? (
          <SettingsHeader autoFocus placement="mobile" />
        ) : sidebarCollapsed ? (
          <ChatHeaderSidebarTrigger />
        ) : undefined
      }
      headerActions={sidebarCollapsed ? <GlobalSearchButton id="global-search-collapsed-trigger" /> : undefined}
    >
      <SettingsLayout>{children}</SettingsLayout>
    </PageLayout>
  );
}
