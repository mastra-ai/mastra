import { PageHeader, PageLayout, SelectField, SettingsIcon, useTheme } from '@mastra/playground-ui';
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

      <PageLayout.MainArea className="grid gap-8 mt-6">
        <section className="rounded-lg border border-border1 bg-surface3 p-4">
          <div className="space-y-3">
            <h2 className="text-icon6 font-medium">Theme</h2>
            <SelectField
              name="theme"
              label="Theme mode"
              value={theme}
              onValueChange={value => setTheme(value as Theme)}
              options={THEME_OPTIONS.map(option => ({ ...option }))}
            />
          </div>
        </section>

        <StudioConfigForm initialConfig={{ baseUrl, headers, apiPrefix }} />
      </PageLayout.MainArea>
    </PageLayout>
  );
};
