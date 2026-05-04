import { PageHeader, PageLayout, SectionCard, SelectField, SettingsIcon, useTheme } from '@mastra/playground-ui';
import type { Theme } from '@mastra/playground-ui';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-context';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();
  const { theme, setTheme } = useTheme();

  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>
            <SettingsIcon /> Settings
          </PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
        <SectionCard title="Theme" description="Customize the appearance of the studio.">
          <SelectField
            name="theme"
            label="Theme mode"
            value={theme}
            onValueChange={value => setTheme(value as Theme)}
            options={THEME_OPTIONS.map(option => ({ ...option }))}
          />
        </SectionCard>

        <SectionCard
          title="Mastra Connection"
          description="Configure the Mastra instance URL, API prefix, and request headers used by the studio."
        >
          <StudioConfigForm initialConfig={{ baseUrl, headers, apiPrefix }} />
        </SectionCard>
      </PageLayout.MainArea>
    </PageLayout>
  );
};
