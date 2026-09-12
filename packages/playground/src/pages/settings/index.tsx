import { SettingsCard } from '@mastra/playground-ui/components/SettingsCard';
import { SettingsLayout } from '@mastra/playground-ui/components/SettingsLayout';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { SettingsSubsection } from '@mastra/playground-ui/components/SettingsSubsection';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();

  return (
    <SettingsLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <SettingsSubsection title="General" description="Stored in this browser.">
          <SettingsCard>
            <SettingsRow variant="factory" label="Theme" description="Customize the appearance of the studio.">
              <ThemeToggle />
            </SettingsRow>
          </SettingsCard>
        </SettingsSubsection>

        <SettingsSubsection
          title="Mastra Connection"
          description="Configure the Mastra instance URL, API prefix, and request headers used by the studio."
        >
          <SettingsCard>
            <div className="p-4">
              <StudioConfigForm initialConfig={{ baseUrl, headers, apiPrefix }} />
            </div>
          </SettingsCard>
        </SettingsSubsection>
      </div>
    </SettingsLayout>
  );
};
