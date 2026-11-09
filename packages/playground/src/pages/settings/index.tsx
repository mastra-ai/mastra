import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import {
  SettingsContainer,
  SettingsGroup,
  SettingsLayout,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { StudioConnectionSettings } from '@/domains/configuration/components/studio-connection-settings';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/settings')];

export const StudioSettingsPage = () => {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Settings</h1>
      <SettingsLayout>
        <SettingsGroup>
          <SettingsTitle info="Stored in this browser.">General</SettingsTitle>
          <SettingsContainer>
            <SettingsRow label="Theme" description="Color scheme for the interface.">
              <ThemeToggle />
            </SettingsRow>
          </SettingsContainer>
        </SettingsGroup>

        <StudioConnectionSettings />
      </SettingsLayout>
    </PageLayout>
  );
};
