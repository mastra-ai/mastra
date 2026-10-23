import { DisabledFeatureButton } from '@mastra/playground-ui/components/DisabledFeatureButton';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { TRACE_PROPERTY_FILTER_PARAM_BY_FIELD } from '@mastra/playground-ui/domains/traces/trace-filters';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { GitBranch, MessageSquare } from 'lucide-react';

/** Tabs that render a pill in the bar. Routes without a pill pass `'none'`. */
export type AgentPageTab = 'chat' | 'versions' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  /** `'none'` (or any non-tab value) leaves the bar unhighlighted. */
  activeTab: AgentPageTab | 'none';
  /** The open conversation. Chat returns to it and Traces opens filtered to it. */
  threadId?: string;
  showPlayground?: boolean;
  showObservability?: boolean;
}

function AgentTab({ value, icon, label }: { value: AgentPageTab; icon: React.ReactNode; label: string }) {
  return (
    <Tab value={value}>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}

export function AgentPageTabs({
  agentId,
  activeTab,
  threadId,
  showPlayground = false,
  showObservability = false,
}: AgentPageTabsProps) {
  const { navigate } = useLinkComponent();

  const hrefMap: Record<AgentPageTab, string> = {
    chat: `/agents/${agentId}/threads/${threadId ?? 'new'}`,
    versions: `/agents/${agentId}/editor`,
    traces: threadId
      ? `/agents/${agentId}/traces?${new URLSearchParams({ [TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.threadId]: threadId })}`
      : `/agents/${agentId}/traces`,
  };

  const handleTabChange = (value: AgentPageTab | 'none') => {
    if (value === 'none') return;
    navigate(hrefMap[value]);
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 p-1.5">
      <Tabs value={activeTab} defaultTab={activeTab} onValueChange={handleTabChange} className="min-w-0">
        <TabList variant="pill-ghost">
          <AgentTab value="chat" icon={<MessageSquare />} label="Chat" />
          {showObservability && <AgentTab value="traces" icon={<TraceIcon />} label="Traces" />}
          {showPlayground && <AgentTab value="versions" icon={<GitBranch />} label="Editor" />}
        </TabList>
      </Tabs>
      {(!showObservability || !showPlayground) && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {!showObservability && (
            <DisabledFeatureButton
              icon={<TraceIcon />}
              label="Traces"
              tooltipContent={
                <>
                  Add <code>@mastra/observability</code> to enable Traces.
                </>
              }
              docsHref="https://mastra.ai/docs/observability/overview"
            />
          )}
          {!showPlayground && (
            <DisabledFeatureButton
              icon={<GitBranch />}
              label="Editor"
              tooltipContent="Add @mastra/editor to enable the Editor."
              docsHref="https://mastra.ai/docs/editor/overview"
            />
          )}
        </div>
      )}
    </div>
  );
}
