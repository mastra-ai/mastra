import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink, GitBranch, MessageSquare } from 'lucide-react';

import { UnavailableToolButton } from '@/components/ui/unavailable-tool-button';
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

  const observabilityDisabledReason = (
    <p>
      Add <code>@mastra/observability</code> to enable this tab.{' '}
      <DocsLink href="https://mastra.ai/docs/observability/overview">Learn more</DocsLink>
    </p>
  );

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
            <UnavailableToolButton icon={<TraceIcon />} label="Traces" reason={observabilityDisabledReason} />
          )}
          {!showPlayground && (
            <UnavailableToolButton
              icon={<GitBranch />}
              label="Editor"
              reason="Add @mastra/editor to enable the Editor."
            />
          )}
        </div>
      )}
    </div>
  );
}
