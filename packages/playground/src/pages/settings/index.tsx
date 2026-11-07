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
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/settings')];

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();

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

        <StudioConfigForm variant="factory" initialConfig={{ baseUrl, headers, apiPrefix }} />
      </SettingsLayout>
    </PageLayout>
  );
};
