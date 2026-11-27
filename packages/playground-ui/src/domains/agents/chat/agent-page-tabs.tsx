import type { ReactNode } from 'react';
import { buttonVariants } from '@/ds/components/Button/Button';
import { DisabledFeatureButton } from '@/ds/components/DisabledFeatureButton';
import { Txt } from '@/ds/components/Txt';
import { IconBranch } from '@/ds/icons/central/IconBranch';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { Icon } from '@/ds/icons/Icon';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export type AgentPageTab = 'chat' | 'versions' | 'traces';

/** A host-defined tab shown after the built-in ones. */
export interface AgentPageExtraTab {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
}

interface AgentPageTabsProps {
  /** A built-in tab, an extra tab's `id`, or `'none'`. */
  activeTab: AgentPageTab | 'none' | (string & {});
  chatHref: string;
  tracesHref?: string;
  versionsHref?: string;
  showUnavailableFeatures?: boolean;
  showObservability?: boolean;
  showPlayground?: boolean;
  extraTabs?: AgentPageExtraTab[];
}

function AgentTab({ href, active, icon, label }: { href: string; active: boolean; icon: ReactNode; label: string }) {
  const { Link } = useLinkComponent();
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'md' }),
        'relative z-10 gap-1.5',
        active && 'text-foreground',
      )}
    >
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Link>
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
  extraTabs = [],
}: AgentPageTabsProps) {
  return (
    <nav aria-label="Agent views" className="flex min-w-0 items-center justify-between gap-2 p-1.5">
      <div className="flex min-w-0 items-center gap-1">
        <AgentTab href={chatHref} active={activeTab === 'chat'} icon={<IconChatBubble7 />} label="Chat" />
        {showObservability && tracesHref && (
          <AgentTab href={tracesHref} active={activeTab === 'traces'} icon={<TraceIcon />} label="Traces" />
        )}
        {showPlayground && versionsHref && (
          <AgentTab href={versionsHref} active={activeTab === 'versions'} icon={<IconBranch />} label="Editor" />
        )}
        {extraTabs.map(tab => (
          <AgentTab key={tab.id} href={tab.href} active={activeTab === tab.id} icon={tab.icon} label={tab.label} />
        ))}
      </div>
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
    </nav>
  );
}
