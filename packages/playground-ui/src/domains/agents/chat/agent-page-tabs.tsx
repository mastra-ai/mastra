import type { ReactNode } from 'react';
import { DisabledFeatureButton } from '@/ds/components/DisabledFeatureButton';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { IconBranch } from '@/ds/icons/central/IconBranch';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { Icon } from '@/ds/icons/Icon';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import { useLinkComponent } from '@/lib/framework';

export type AgentPageTab = 'chat' | 'versions' | 'traces';

interface AgentPageTabsProps {
  activeTab: AgentPageTab | 'none';
  chatHref: string;
  tracesHref?: string;
  versionsHref?: string;
  showUnavailableFeatures?: boolean;
  showObservability?: boolean;
  showPlayground?: boolean;
}

function AgentTab({ value, icon, label }: { value: AgentPageTab; icon: ReactNode; label: string }) {
  return (
    <Tab value={value}>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}

/** Studio agent tabs, with route destinations supplied by the host. */
export function AgentPageTabs({
  activeTab,
  chatHref,
  tracesHref,
  versionsHref,
  showPlayground = false,
  showObservability = false,
  showUnavailableFeatures = true,
}: AgentPageTabsProps) {
  const { navigate } = useLinkComponent();

  const handleTabChange = (value: AgentPageTab | 'none') => {
    if (value === 'chat') navigate(chatHref);
    if (value === 'traces' && tracesHref) navigate(tracesHref);
    if (value === 'versions' && versionsHref) navigate(versionsHref);
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 p-1.5">
      <Tabs value={activeTab} defaultTab={activeTab} onValueChange={handleTabChange} className="min-w-0">
        <TabList variant="pill-ghost">
          <AgentTab value="chat" icon={<IconChatBubble7 />} label="Chat" />
          {showObservability && tracesHref && <AgentTab value="traces" icon={<TraceIcon />} label="Traces" />}
          {showPlayground && versionsHref && <AgentTab value="versions" icon={<IconBranch />} label="Editor" />}
        </TabList>
      </Tabs>
      {showUnavailableFeatures && (!showObservability || !showPlayground) && (
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
              icon={<IconBranch />}
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
