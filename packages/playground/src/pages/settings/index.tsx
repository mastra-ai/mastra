import {
  useStudioConfig,
  StudioConfigForm,
  MainContentLayout,
  Header,
  HeaderTitle,
  Icon,
  SettingsIcon,
  MainContentContent,
  SelectField,
  usePlaygroundStore,
} from '@mastra/playground-ui';
import { useEffect, useRef, useState } from 'react';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

export const StudioSettingsPage = () => {
  const { baseUrl, headers } = useStudioConfig();
  const { theme, setTheme } = usePlaygroundStore();
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const selectedThemeRef = useRef(theme);

  useEffect(() => {
    setSelectedTheme(theme);
    selectedThemeRef.current = theme;
  }, [theme]);

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <SettingsIcon />
          </Icon>
          Settings
        </HeaderTitle>
      </Header>
      <MainContentContent>
        <div className="max-w-2xl mx-auto w-full mt-8 space-y-8">
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
            initialConfig={{ baseUrl, headers }}
            onSave={() => {
              setTheme(selectedThemeRef.current);
            }}
          />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
};
