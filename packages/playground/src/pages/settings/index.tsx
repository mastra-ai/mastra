import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';
import type { Theme } from '@mastra/playground-ui/components/ThemeProvider';
import type { LucideIcon } from 'lucide-react';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
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
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 opacity-70" />
      <span className="min-w-0 truncate">{option.label}</span>
    </span>
  );
}

export const StudioSettingsPage = () => {
  const { baseUrl, headers, apiPrefix } = useStudioConfig();
  const { theme, setTheme } = useTheme();

  return (
    <PageLayout width="narrow">
      <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
        <SectionCard title="Theme" description="Customize the appearance of the studio.">
          <SettingsRow label="Theme mode" htmlFor="theme">
            <Select
              value={theme}
              onValueChange={value => {
                if (isTheme(value)) setTheme(value);
              }}
            >
              <SelectTrigger id="theme" className="w-full sm:w-48">
                <SelectValue className="inline-flex min-w-0 max-w-full items-center" />
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
          <StudioConfigForm initialConfig={{ baseUrl, headers, apiPrefix }} />
        </SectionCard>
      </PageLayout.MainArea>
    </PageLayout>
  );
};
