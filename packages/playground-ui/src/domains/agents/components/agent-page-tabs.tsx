import { EyeIcon, FlaskConical, MessageSquare } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Icon } from '@/ds/icons/Icon';
import { Txt } from '@/ds/components/Txt';
import { useLinkComponent } from '@/lib/framework';

export type AgentPageTab = 'chat' | 'playground' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  activeTab: AgentPageTab;
  showPlayground?: boolean;
}

function TabLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const { navigate } = useLinkComponent();

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2',
        active ? 'border-white/50 text-neutral5' : 'border-transparent text-neutral3 hover:text-neutral5',
      )}
    >
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
    </button>
  );
}

export function AgentPageTabs({ agentId, activeTab, showPlayground = false }: AgentPageTabsProps) {
  return (
    <div className="flex items-center border-b border-border1 px-4 bg-surface1">
      <TabLink
        href={`/agents/${agentId}/chat/new`}
        active={activeTab === 'chat'}
        icon={<MessageSquare />}
        label="Chat"
      />
      {showPlayground && (
        <TabLink
          href={`/agents/${agentId}/playground`}
          active={activeTab === 'playground'}
          icon={<FlaskConical />}
          label="Playground"
        />
      )}
      <TabLink href={`/agents/${agentId}/traces`} active={activeTab === 'traces'} icon={<EyeIcon />} label="Traces" />
    </div>
  );
}
