import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import type { Theme } from '@mastra/playground-ui/components/ThemeProvider';
import { useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-state';

const THEME_OPTIONS: { value: Theme; label: string; Icon: LucideIcon }[] = [
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
];

const isTheme = (value: string): value is Theme => THEME_OPTIONS.some(option => option.value === value);

function ThemeOptionLabel({ option }: { option: (typeof THEME_OPTIONS)[number] }) {
  const { Icon } = option;

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 opacity-70" />
      <span className="min-w-0 truncate">{option.label}</span>
    </span>
  );
}

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [saveCount, setSaveCount] = useState(0);

  // Auth capabilities and permission patterns are cached from the previous
  // headers, so the auth gate keeps the user out until they are refetched.
  // This effect runs before the providers above adopt the saved config, so the
  // invalidation is deferred one tick — otherwise the refetch still carries
  // the previous headers.
  useEffect(() => {
    if (saveCount === 0) return;

    const timeout = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'capabilities'] });
      queryClient.invalidateQueries({ queryKey: ['permission-patterns'] });
    }, 0);

    return () => clearTimeout(timeout);
  }, [saveCount, queryClient]);

  return (
    <PageLayout width="narrow">
      <PageLayout.MainArea className="mt-6 flex flex-col gap-5">
        <SectionCard title="Theme" description="Customize the appearance of the studio.">
          <SettingsRow label="Theme mode" htmlFor="theme">
            <Select
              value={theme}
              onValueChange={value => {
                if (isTheme(value)) setTheme(value);
              }}
            >
              <SelectTrigger id="theme" className="w-full sm:w-48">
                <SelectValue className="inline-flex max-w-full min-w-0 items-center" />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <ThemeOptionLabel option={option} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SectionCard>

        <SectionCard
          title="Mastra Connection"
          description="Configure the Mastra instance URL, API prefix, and request headers used by the studio."
        >
          <StudioConfigForm
            initialConfig={{ baseUrl, headers, apiPrefix }}
            onSave={() => setSaveCount(count => count + 1)}
          />
        </SectionCard>
      </PageLayout.MainArea>
    </PageLayout>
  );
};
