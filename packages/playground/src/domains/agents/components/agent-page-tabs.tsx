import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ExternalLink, EyeIcon, FlaskConical, MessageSquare, ClipboardCheck } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';

/** Tabs that render a pill in the bar. Routes without a pill (e.g. settings) pass `'none'`. */
export type AgentPageTab = 'chat' | 'evaluate' | 'review' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  /** `'none'` (or any non-tab value) leaves the bar unhighlighted. */
  activeTab: AgentPageTab | 'none';
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
          <button
            type="button"
            aria-disabled="true"
            className="text-ui-md font-normal text-neutral3 whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 outline-none cursor-not-allowed opacity-50 rounded-full px-3 py-2.5 focus-visible:ring-1 focus-visible:ring-accent1"
            onClick={event => event.preventDefault()}
          >
            {tabContent}
          </button>
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
  showObservability = false,
  reviewBadge,
  rightSlot,
}: AgentPageTabsProps) {
  const { navigate } = useLinkComponent();

  const observabilityDisabledReason = !showObservability ? (
    <p>
      Add <code>@mastra/observability</code> to enable this tab.{' '}
      <DocsLink href="https://mastra.ai/docs/observability/overview">Learn more</DocsLink>
    </p>
  ) : undefined;

  const hrefMap: Record<AgentPageTab, string> = {
    chat: `/agents/${agentId}/chat/new`,
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
        className="flex-1 min-w-0 max-lg:flex-auto"
      >
        <TabList variant="pill-ghost">
          <AgentTab value="chat" icon={<MessageSquare />} label="Chat" />
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
