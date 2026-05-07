import {
  PageHeader,
  PageLayout,
  SectionCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsIcon,
  SettingsRow,
  useTheme,
} from '@mastra/playground-ui';
import type { Theme } from '@mastra/playground-ui';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-context';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

const isTheme = (value: string): value is Theme => THEME_OPTIONS.some(option => option.value === value);

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
          <SettingsRow label="Theme mode" htmlFor="theme">
            <Select
              value={theme}
              onValueChange={value => {
                if (isTheme(value)) setTheme(value);
              }}
            >
              <SelectTrigger id="theme" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
