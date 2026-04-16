import { PageHeader, PageLayout, SelectField, SettingsIcon } from '@mastra/playground-ui';
import { useEffect, useRef, useState } from 'react';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-context';
import { usePlaygroundStore } from '@/store/playground-store';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();
  const { theme, setTheme } = usePlaygroundStore();
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const selectedThemeRef = useRef(theme);

  useEffect(() => {
    setSelectedTheme(theme);
    selectedThemeRef.current = theme;
  }, [theme]);

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
              value={selectedTheme}
              onValueChange={value => {
                const nextTheme = value as 'dark' | 'light' | 'system';
                selectedThemeRef.current = nextTheme;
                setSelectedTheme(nextTheme);
              }}
              options={THEME_OPTIONS.map(option => ({ ...option }))}
            />
          </div>
        </section>

        <StudioConfigForm
          initialConfig={{ baseUrl, headers, apiPrefix }}
          onSave={() => {
            setTheme(selectedThemeRef.current);
          }}
        />
      </PageLayout.MainArea>
    </PageLayout>
  );
};
