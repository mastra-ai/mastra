import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';

import { ChatHeaderSidebarTrigger } from '../domains/chat/components/ChatHeaderSidebarTrigger';
import { GlobalSearchButton } from '../domains/search/components/GlobalSearchButton';
import { SettingsHeader } from '../domains/settings/components/SettingsHeader';
import { SettingsPanel } from '../domains/settings/components/SettingsPanel';
import {
  SETTINGS_SECTION_LABELS,
  isSettingsSection,
  retiredSettingsTarget,
  settingsSectionPath,
} from '../domains/settings/settingsSections';

export function SettingsPage() {
  const { section, factoryId } = useParams();
  const location = useLocation();

  const retired = retiredSettingsTarget(section, location.hash);
  if (factoryId && retired) {
    return (
      <Navigate
        to={{
          pathname: settingsSectionPath(factoryId, retired.section),
          search: location.search,
          hash: retired.anchor ?? location.hash,
        }}
        replace
        state={location.state}
      />
    );
  }

  if (!isSettingsSection(section)) {
    return <Navigate to="../preferences" replace state={location.state} />;
  }
  return (
    <SettingsPageLayout
      header={
        <PageHeader>
          <AnnouncedSectionTitle key={section}>{SETTINGS_SECTION_LABELS[section]}</AnnouncedSectionTitle>
        </PageHeader>
      }
    >
      <SettingsPanel />
    </SettingsPageLayout>
  );
}

function AnnouncedSectionTitle({ children }: { children: ReactNode }) {
  const id = useId();
  const { isMobile } = useSidebar();
  useEffect(() => {
    if (!isMobile) document.getElementById(id)?.focus();
  }, [id, isMobile]);
  return (
    <PageHeader.Title id={id} tabIndex={-1} className="outline-hidden">
      {children}
    </PageHeader.Title>
  );
}

export function SettingsPageLayout({
  children,
  header,
  breadcrumbs,
}: {
  children: ReactNode;
  header: ReactNode;
  breadcrumbs?: ReactNode;
}) {
  const { isMobile, desktopState } = useSidebar();
  const sidebarCollapsed = !isMobile && desktopState === 'collapsed';

  return (
    <PageLayout
      variant="narrow"
      breadcrumbs={
        breadcrumbs ??
        (isMobile ? <SettingsHeader autoFocus /> : sidebarCollapsed ? <ChatHeaderSidebarTrigger /> : undefined)
      }
      headerActions={sidebarCollapsed ? <GlobalSearchButton id="global-search-collapsed-trigger" /> : undefined}
    >
      {header}
      {children}
    </PageLayout>
  );
}
