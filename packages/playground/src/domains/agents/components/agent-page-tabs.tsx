import { Button } from '@mastra/playground-ui/components/Button';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { ExternalLink, FlaskConical, GitBranch, MessageSquare } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';

/** Tabs that render a pill in the bar. Routes without a pill pass `'none'`. */
export type AgentPageTab = 'chat' | 'versions' | 'evaluate' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  /** `'none'` (or any non-tab value) leaves the bar unhighlighted. */
  activeTab: AgentPageTab | 'none';
  showPlayground?: boolean;
  showObservability?: boolean;
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
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
    </>
  );

  return (
    <Tab value={value} disabled={disabled} disabledTooltip={disabledReason}>
      {tabContent}
    </Tab>
  );
}

export function AgentPageTabs({
  agentId,
  activeTab,
  showPlayground = false,
  showObservability = false,
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
    chat: `/agents/${agentId}/threads/new`,
    versions: `/agents/${agentId}/editor`,
    evaluate: `/agents/${agentId}/evaluate`,
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
            value="traces"
            icon={<TraceIcon />}
            label="Traces"
            disabled={!showObservability}
            disabledReason={observabilityDisabledReason}
          />
          {showObservability && <AgentTab value="evaluate" icon={<FlaskConical />} label="Evals" />}
          {showPlayground && <AgentTab value="versions" icon={<GitBranch />} label="Editor" />}
        </TabList>
      </Tabs>
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
        {!showObservability && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Evals"
            aria-disabled="true"
            tooltip={observabilityDisabledReason}
          >
            <FlaskConical />
          </Button>
        )}
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
