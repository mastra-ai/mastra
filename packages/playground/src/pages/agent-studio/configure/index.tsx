import { DashboardCard, PageHeader, PageLayout, SelectField } from '@mastra/playground-ui';
import { PaletteIcon, SettingsIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAgentStudioConfig } from '@/domains/agent-studio/hooks/use-agent-studio-config';
import { StudioConfigForm } from '@/domains/configuration/components/studio-config-form';
import { useStudioConfig } from '@/domains/configuration/context/studio-config-context';
import { useLinkComponent } from '@/lib/framework';
import { usePlaygroundStore } from '@/store/playground-store';

type ConfigureEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  enabled: boolean;
};

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

export function AgentStudioConfigure() {
  const { config } = useAgentStudioConfig();
  const { Link } = useLinkComponent();
  const { baseUrl, headers, apiPrefix } = useStudioConfig();
  const { theme, setTheme } = usePlaygroundStore();
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const selectedThemeRef = useRef(theme);

  useEffect(() => {
    setSelectedTheme(theme);
    selectedThemeRef.current = theme;
  }, [theme]);

  const allowAppearance = config?.configure?.allowAppearance ?? true;

  const entries: ConfigureEntry[] = [
    {
      id: 'skills',
      title: 'Skills',
      description: 'Create and manage skills to share with your team.',
      href: '/agent-studio/configure/skills',
      icon: <SparklesIcon />,
      enabled: config?.configure?.allowSkillCreation ?? true,
    },
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Choose between light and dark mode.',
      href: '/agent-studio/configure/appearance',
      icon: <PaletteIcon />,
      enabled: allowAppearance,
    },
  ].filter(entry => entry.enabled);

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title>
                <SettingsIcon /> Configure
              </PageHeader.Title>
              <PageHeader.Description>Manage your skills, appearance, and preferences.</PageHeader.Description>
            </PageHeader>
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <div
        className="grid gap-4 p-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))' }}
        data-testid="configure-grid"
      >
        {entries.map(entry => (
          <Link key={entry.id} href={entry.href} data-testid={`configure-entry-${entry.id}`}>
            <DashboardCard className="hover:border-border2 transition-colors h-full flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {entry.icon}
                {entry.title}
              </div>
              <p className="text-xs text-icon4">{entry.description}</p>
            </DashboardCard>
          </Link>
        ))}
      </div>

      {allowAppearance && (
        <PageLayout.MainArea className="grid gap-8 mt-6 p-4" data-testid="configure-settings">
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
      )}
    </PageLayout>
  );
}

export default AgentStudioConfigure;
