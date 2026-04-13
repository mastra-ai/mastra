import { Txt, Icon, cn } from '@mastra/playground-ui';
import { EyeIcon, FlaskConical, MessageSquare, ClipboardCheck, GitBranch } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';

export type AgentPageTab = 'chat' | 'versions' | 'evaluate' | 'review' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  activeTab: AgentPageTab;
  showPlayground?: boolean;
  showObservability?: boolean;
  reviewBadge?: number;
  rightSlot?: React.ReactNode;
}

function TabLink({
  href,
  active,
  icon,
  label,
  badge,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  const { navigate } = useLinkComponent();

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2',
        active
          ? 'border-black/50 dark:border-white/50 text-neutral5'
          : 'border-transparent text-neutral3 hover:text-neutral5',
      )}
    >
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 bg-accent1 text-white text-xs font-medium rounded-full px-1.5 py-0 min-w-[18px] text-center leading-[18px]">
          {badge}
        </span>
      )}
    </button>
  );
}

export function AgentPageTabs({
  agentId,
  activeTab,
  showPlayground = false,
  showObservability = false,
  reviewBadge,
  rightSlot,
}: AgentPageTabsProps) {
  return (
    <div className="flex items-center border-b border-border1 px-4 bg-surface2">
      <TabLink
        href={`/agents/${agentId}/chat/new`}
        active={activeTab === 'chat'}
        icon={<MessageSquare />}
        label="Chat"
      />
      {showPlayground && (
        <TabLink
          href={`/agents/${agentId}/editor`}
          active={activeTab === 'versions'}
          icon={<GitBranch />}
          label="Editor"
        />
      )}
      {showObservability && (
        <>
          <TabLink
            href={`/agents/${agentId}/evaluate`}
            active={activeTab === 'evaluate'}
            icon={<FlaskConical />}
            label="Evaluate"
          />
          <TabLink
            href={`/agents/${agentId}/review`}
            active={activeTab === 'review'}
            icon={<ClipboardCheck />}
            label="Review"
            badge={reviewBadge}
          />
        </>
      )}
      {showObservability && (
        <TabLink href={`/agents/${agentId}/traces`} active={activeTab === 'traces'} icon={<EyeIcon />} label="Traces" />
      )}
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
