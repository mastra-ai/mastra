import { Button } from '@mastra/playground-ui/components/Button';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink, GitBranch, MessageSquare } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';

/** Tabs that render a pill in the bar. Routes without a pill pass `'none'`. */
export type AgentPageTab = 'chat' | 'versions' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  /** `'none'` (or any non-tab value) leaves the bar unhighlighted. */
  activeTab: AgentPageTab | 'none';
  showPlayground?: boolean;
  showObservability?: boolean;
}

function DocsLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-inherit underline hover:text-foreground',
        controlStateColorTransition,
      )}
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
  disabled,
  disabledReason,
}: {
  value: AgentPageTab;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
}) {
  const tabContent = (
    <>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </>
  );

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            <Tab value={value} disabled>
              {tabContent}
            </Tab>
          </span>
        </TooltipTrigger>
        {disabledReason && <TooltipContent side="bottom">{disabledReason}</TooltipContent>}
      </Tooltip>
    );
  }

  return <Tab value={value}>{tabContent}</Tab>;
}

export function AgentPageTabs({
  agentId,
  activeTab,
  showPlayground = false,
  showObservability = false,
}: AgentPageTabsProps) {
  const { navigate } = useLinkComponent();

  const observabilityDisabledReason = !showObservability ? (
    <p>
      Add <code>@mastra/observability</code> to enable this tab.{' '}
      <DocsLink href="https://mastra.ai/docs/observability/overview">Learn more</DocsLink>
    </p>
  ) : undefined;

  const hrefMap: Record<AgentPageTab, string> = {
    chat: `/agents/${agentId}/threads/new`,
    versions: `/agents/${agentId}/editor`,
    traces: `/agents/${agentId}/traces`,
  };

  const handleTabChange = (value: AgentPageTab | 'none') => {
    if (value === 'none') return;
    navigate(hrefMap[value]);
  };

  return (
    // Below lg the trailing buttons wrap onto their own line (right-aligned)
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
            value="traces"
            icon={<TraceIcon />}
            label="Traces"
            disabled={!showObservability}
            disabledReason={observabilityDisabledReason}
          />
          {showPlayground && <AgentTab value="versions" icon={<GitBranch />} label="Editor" />}
        </TabList>
      </Tabs>
      <div className="ml-auto flex items-center gap-2">
        {!showPlayground && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Editor"
            aria-disabled="true"
            tooltip="Add @mastra/editor to enable the Editor."
          >
            <GitBranch />
          </Button>
        )}
      </div>
    </div>
  );
}
