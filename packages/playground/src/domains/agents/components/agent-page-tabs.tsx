import { Tab, TabList, Tabs, Tooltip, TooltipContent, TooltipTrigger, Txt, Icon } from '@mastra/playground-ui';
import { ExternalLink, EyeIcon, FlaskConical, MessageSquare, ClipboardCheck, GitBranch } from 'lucide-react';

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

function DocsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline text-inherit hover:text-white"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function AgentTab({
  value,
  icon,
  label,
  badge,
  disabled,
  disabledReason,
}: {
  value: AgentPageTab;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
}) {
  const tabContent = (
    <>
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 bg-accent1 text-white text-xs font-medium rounded-full px-1.5 py-0 min-w-[18px] text-center leading-[18px]">
          {badge}
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Tab value={value} disabled className="px-3 py-2.5">
              {tabContent}
            </Tab>
          </span>
        </TooltipTrigger>
        {disabledReason && <TooltipContent side="bottom">{disabledReason}</TooltipContent>}
      </Tooltip>
    );
  }

  return (
    <Tab value={value} className="px-3 py-2.5">
      {tabContent}
    </Tab>
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
  const { navigate } = useLinkComponent();

  const playgroundDisabledReason = !showPlayground ? (
    <p>
      Configure <code>@mastra/editor</code> to use the Editor.{' '}
      <DocsLink href="https://mastra.ai/docs/editor/overview">Learn more</DocsLink>
    </p>
  ) : undefined;
  const observabilityDisabledReason = !showObservability ? (
    <p>
      Add <code>@mastra/observability</code> to enable this tab.{' '}
      <DocsLink href="https://mastra.ai/docs/observability/overview">Learn more</DocsLink>
    </p>
  ) : undefined;

  const hrefMap: Record<AgentPageTab, string> = {
    chat: `/agents/${agentId}/chat/new`,
    versions: `/agents/${agentId}/editor`,
    evaluate: `/agents/${agentId}/evaluate`,
    review: `/agents/${agentId}/review`,
    traces: `/agents/${agentId}/traces`,
  };

  const handleTabChange = (value: AgentPageTab) => {
    navigate(hrefMap[value]);
  };

  return (
    <div className="flex items-center gap-2">
      <Tabs value={activeTab} defaultTab={activeTab} onValueChange={handleTabChange} className="flex-1 min-w-0">
        <TabList>
          <AgentTab value="chat" icon={<MessageSquare />} label="Chat" />
          <AgentTab
            value="versions"
            icon={<GitBranch />}
            label="Editor"
            disabled={!showPlayground}
            disabledReason={playgroundDisabledReason}
          />
          <AgentTab
            value="evaluate"
            icon={<FlaskConical />}
            label="Evaluate"
            disabled={!showObservability}
            disabledReason={observabilityDisabledReason}
          />
          <AgentTab
            value="review"
            icon={<ClipboardCheck />}
            label="Review"
            badge={reviewBadge}
            disabled={!showObservability}
            disabledReason={observabilityDisabledReason}
          />
          <AgentTab
            value="traces"
            icon={<EyeIcon />}
            label="Traces"
            disabled={!showObservability}
            disabledReason={observabilityDisabledReason}
          />
        </TabList>
      </Tabs>
      {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
