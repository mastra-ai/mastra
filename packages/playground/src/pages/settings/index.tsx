import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import {
  SettingsContainer,
  SettingsGroup,
  SettingsLayout,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { StudioConnectionSettings } from '@/domains/configuration/components/studio-connection-settings';

export const StudioSettingsPage = () => {
  return (
    <PageLayout>
      <SettingsLayout title="Settings">
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
