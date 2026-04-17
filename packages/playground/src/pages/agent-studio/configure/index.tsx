import { DashboardCard, PageHeader, PageLayout } from '@mastra/playground-ui';
import { PaletteIcon, SettingsIcon, SparklesIcon } from 'lucide-react';
import { useAgentStudioConfig } from '@/domains/agent-studio/hooks/use-agent-studio-config';
import { useLinkComponent } from '@/lib/framework';

type ConfigureEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  enabled: boolean;
};

export function AgentStudioConfigure() {
  const { config } = useAgentStudioConfig();
  const { Link } = useLinkComponent();

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
      enabled: config?.configure?.allowAppearance ?? true,
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
    </PageLayout>
  );
}

export default AgentStudioConfigure;
