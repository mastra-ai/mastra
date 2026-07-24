import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Navigate, useLocation, useParams } from 'react-router';

import { Sidebar } from '../Sidebar';
import { PageLayout } from '../layouts/PageLayout';
import { ChatHeader } from '../domains/chat/components/ChatHeader';
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
  const { factoryId } = useParams<{ factoryId: string }>();
  const { isMobile } = useMainSidebar();

  if (!factoryId) {
    return (
      <main className="bg-surface2 flex min-h-dvh flex-col">
        {isMobile && (
          <div className="bg-surface2 sticky top-0 z-2 shrink-0 px-3 py-2">
            <SettingsHeader autoFocus placement="mobile" />
          </div>
        )}
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
