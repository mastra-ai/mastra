import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Navigate, useLocation, useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { PageLayout } from '../ui/PageLayout';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { useActiveFactoryContext } from '../domains/workspaces/context/ActiveFactoryProvider';
import { SettingsHeader } from '../domains/settings/components/SettingsHeader';
import { SettingsPanel } from '../domains/settings/components/SettingsPanel';
import { isSettingsSection } from '../domains/settings/settingsSections';

/**
 * Routed settings page (`/settings/:section`). Sections are URL-addressable;
 * unknown sections redirect to the default. With an active factory the page
 * keeps the standard app frame (sidebar swaps to section navigation); without
 * one it renders full-bleed, as there is no sidebar to frame.
 */
export function SettingsPage() {
  const { section } = useParams();
  const location = useLocation();

  if (!isSettingsSection(section)) {
    return <Navigate to="../general" replace state={location.state} />;
  }
  return <SettingsPageContent />;
}

function SettingsPageContent() {
  const { activeFactory } = useActiveFactoryContext();
  const { isMobile } = useMainSidebar();

  if (!activeFactory) {
    return (
      <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-surface2">
        {isMobile && <SettingsHeader autoFocus placement="mobile" />}
        <SettingsPanel />
      </main>
    );
  }
  return (
    <PageLayout
      sidebar={<Sidebar />}
      header={<ChatHeader mobileContent={isMobile ? <SettingsHeader autoFocus placement="mobile" /> : undefined} />}
    >
      <SettingsPanel />
    </PageLayout>
  );
}
