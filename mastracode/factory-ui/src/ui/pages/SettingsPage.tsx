import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';

import { ChatHeaderSidebarTrigger } from '../domains/chat/components/ChatHeaderSidebarTrigger';
import { GlobalSearchButton } from '../domains/search/components/GlobalSearchButton';
import { SettingsHeader } from '../domains/settings/components/SettingsHeader';
import { SettingsPanel } from '../domains/settings/components/SettingsPanel';
import { SETTINGS_SECTION_LABELS, isSettingsSection } from '../domains/settings/settingsSections';

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
    <SettingsPageLayout
      header={
        <PageHeader>
          <FocusedTitle key={section}>{SETTINGS_SECTION_LABELS[section]}</FocusedTitle>
        </PageHeader>
      }
    >
      <SettingsPanel />
    </SettingsPageLayout>
  );
}

/** Moves focus to the section title on desktop so section switches are announced; mobile focuses its own title. */
function FocusedTitle({ children }: { children: ReactNode }) {
  const id = useId();
  const { isMobile } = useMainSidebar();
  useEffect(() => {
    if (!isMobile) document.getElementById(id)?.focus();
  }, [id, isMobile]);
  return (
    <PageHeader.Title id={id} tabIndex={-1} className="outline-hidden">
      {children}
    </PageHeader.Title>
  );
}

/**
 * Settings body: on mobile the section title lives in the page header row
 * (the desktop title is rendered by the panel itself); with a collapsed
 * desktop sidebar the header row carries the sidebar trigger and search.
 */
export function SettingsPageLayout({
  children,
  header,
  breadcrumbs,
}: {
  children: ReactNode;
  header: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  const { isMobile, desktopState } = useMainSidebar();
  const sidebarCollapsed = !isMobile && desktopState === 'collapsed';

  return (
    <PageLayout
      variant="narrow"
      header={header}
      breadcrumbs={
        breadcrumbs ??
        (isMobile ? <SettingsHeader autoFocus /> : sidebarCollapsed ? <ChatHeaderSidebarTrigger /> : undefined)
      }
      headerActions={sidebarCollapsed ? <GlobalSearchButton id="global-search-collapsed-trigger" /> : undefined}
    >
      {children}
    </PageLayout>
  );
}
