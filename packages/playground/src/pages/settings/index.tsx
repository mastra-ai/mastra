import { SettingsLayout } from '@mastra/playground-ui/components/SettingsLayout';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { ThemeToggle } from '@mastra/playground-ui/components/ThemeToggle';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();

  return (
    <SettingsLayout>
      <SettingsRow label="Theme" description="Customize the appearance of the studio.">
        <ThemeToggle />
      </SettingsRow>

      <div className="flex min-w-0 flex-col gap-6">
        <SettingsRow
          label="Mastra Connection"
          description="Configure the Mastra instance URL, API prefix, and request headers used by the studio."
        />
        <StudioConfigForm initialConfig={{ baseUrl, headers, apiPrefix }} />
      </div>
    </SettingsLayout>
  );
};
