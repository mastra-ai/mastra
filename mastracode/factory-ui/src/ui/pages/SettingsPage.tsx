import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { CrumbDef } from '@mastra/playground-ui/components/PageBreadcrumbs';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';

import { SettingsPanel } from '../domains/settings/components/SettingsPanel';
import { isSettingsSection, SETTINGS_SECTION_LABELS, settingsSectionPath } from '../domains/settings/settingsSections';
import { FactoryBreadcrumbs } from '../ui/FactoryBreadcrumbs';

/**
 * Routed settings page (`/settings/:section`). Sections are URL-addressable;
 * unknown sections redirect to the default. The sidebar swaps to section
 * navigation; the page itself is a standard container layout.
 */
export function SettingsPage() {
  const { section } = useParams();
  const location = useLocation();

  if (!isSettingsSection(section)) {
    return <Navigate to="../preferences" replace state={location.state} />;
  }
  return (
    <SettingsPageLayout crumbs={[{ id: 'section', label: SETTINGS_SECTION_LABELS[section] }]}>
      <SettingsPanel />
    </SettingsPageLayout>
  );
}

export function SettingsPageLayout({ crumbs, children }: { crumbs: CrumbDef[]; children: ReactNode }) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();

  return (
    <PageLayout
      breadcrumbs={
        <FactoryBreadcrumbs
          crumbs={[{ id: 'settings', label: 'Settings', to: settingsSectionPath(factoryId, 'preferences') }, ...crumbs]}
        />
      }
    >
      {children}
    </PageLayout>
  );
}
