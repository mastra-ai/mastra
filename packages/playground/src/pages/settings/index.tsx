import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import {
  SettingsContainer,
  SettingsDescription,
  SettingsGroup,
  SettingsHeader,
  SettingsLayout,
  SettingsRow,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();

  return (
    <SettingsLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <SettingsGroup>
          <SettingsHeader>
            <SettingsTitle>General</SettingsTitle>
            <SettingsDescription>Stored in this browser.</SettingsDescription>
          </SettingsHeader>
          <SettingsContainer>
            <SettingsRow label="Theme" description="Customize the appearance of the studio.">
              <ThemeToggle />
            </SettingsRow>
          </SettingsContainer>
        </SettingsGroup>

        <SettingsGroup>
          <SettingsHeader>
            <SettingsTitle>Mastra Connection</SettingsTitle>
            <SettingsDescription>
              Configure the Mastra instance URL, API prefix, and request headers used by the studio.
            </SettingsDescription>
          </SettingsHeader>
          <StudioConfigForm variant="factory" initialConfig={{ baseUrl, headers, apiPrefix }} />
        </SettingsGroup>
      </div>
    </SettingsLayout>
  );
};
