import { DisabledFeatureButton } from '@mastra/playground-ui/components/DisabledFeatureButton';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
  showPlayground = false,
  showObservability = false,
}: AgentPageTabsProps) {
  const { navigate } = useLinkComponent();

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
