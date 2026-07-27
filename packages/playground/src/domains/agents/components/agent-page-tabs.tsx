import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ExternalLink, EyeIcon, FlaskConical, MessageSquare, ClipboardCheck, GitBranch } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';

/** Tabs that render a pill in the bar. Routes without a pill (e.g. settings) pass `'none'`. */
export type AgentPageTab = 'chat' | 'versions' | 'evaluate' | 'review' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  /** `'none'` (or any non-tab value) leaves the bar unhighlighted. */
  activeTab: AgentPageTab | 'none';
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
      className="inline-flex items-center gap-1 text-inherit underline hover:text-white"
    >
      {children}
      <ExternalLink className="size-3" />
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
        <span className="bg-accent1 ml-1 min-w-[18px] rounded-full px-1.5 py-0 text-center text-xs leading-[18px] font-medium text-white">
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

  const handleTabChange = (value: AgentPageTab | 'none') => {
    if (value === 'none') return;
    navigate(hrefMap[value]);
  };

  return (
    // Below lg the rightSlot buttons wrap onto their own line (right-aligned)
    // when the full tab list no longer fits, so the tabs keep the full row width.
    <div className="flex min-w-0 items-center gap-2 p-1.5 max-lg:flex-wrap">
      <Tabs
        value={activeTab}
        defaultTab={activeTab}
        onValueChange={handleTabChange}
        className="min-w-0 flex-1 max-lg:flex-auto"
      >
        <TabList variant="pill-ghost">
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
      {rightSlot && <div className="ml-auto flex items-center gap-2">{rightSlot}</div>}
    </div>
  );
}
