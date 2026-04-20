import { Tooltip, TooltipContent, TooltipTrigger, buttonVariants, cn } from '@mastra/playground-ui';
import { ExternalLink, EyeIcon, FlaskConical, MessageSquare, ClipboardCheck, GitBranch } from 'lucide-react';

import { PanelToggleButtons } from './panel-toggle-buttons';
import { useLinkComponent } from '@/lib/framework';

export type AgentPageTab = 'chat' | 'versions' | 'evaluate' | 'review' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  activeTab: AgentPageTab;
  hasMemory?: boolean;
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

interface TabLinkProps {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
}

function TabLink({ href, active, icon, label, badge, disabled, disabledReason }: TabLinkProps) {
  const { Link } = useLinkComponent();
  const tabClasses = buttonVariants({ variant: active ? 'default' : 'ghost', size: 'default' });

  const content = (
    <>
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent1 px-1 text-ui-xs font-medium text-white">
          {badge}
        </span>
      )}
    </>
  );

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(tabClasses, 'cursor-not-allowed opacity-50')} aria-disabled>
            {content}
          </span>
        </TooltipTrigger>
        {disabledReason && <TooltipContent side="bottom">{disabledReason}</TooltipContent>}
      </Tooltip>
    );
  }

  return (
    <Link to={href} className={tabClasses}>
      {content}
    </Link>
  );
}

export function AgentPageTabs({
  agentId,
  activeTab,
  hasMemory = false,
  showPlayground = false,
  showObservability = false,
  reviewBadge,
  rightSlot,
}: AgentPageTabsProps) {
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

  const tabs: Array<TabLinkProps & { id: AgentPageTab }> = [
    {
      id: 'chat',
      href: `/agents/${agentId}/chat/new`,
      active: activeTab === 'chat',
      icon: <MessageSquare />,
      label: 'Chat',
    },
    {
      id: 'versions',
      href: `/agents/${agentId}/editor`,
      active: activeTab === 'versions',
      icon: <GitBranch />,
      label: 'Editor',
      disabled: !showPlayground,
      disabledReason: playgroundDisabledReason,
    },
    {
      id: 'evaluate',
      href: `/agents/${agentId}/evaluate`,
      active: activeTab === 'evaluate',
      icon: <FlaskConical />,
      label: 'Evaluate',
      disabled: !showObservability,
      disabledReason: observabilityDisabledReason,
    },
    {
      id: 'review',
      href: `/agents/${agentId}/review`,
      active: activeTab === 'review',
      icon: <ClipboardCheck />,
      label: 'Review',
      badge: reviewBadge,
      disabled: !showObservability,
      disabledReason: observabilityDisabledReason,
    },
    {
      id: 'traces',
      href: `/agents/${agentId}/traces`,
      active: activeTab === 'traces',
      icon: <EyeIcon />,
      label: 'Traces',
      disabled: !showObservability,
      disabledReason: observabilityDisabledReason,
    },
  ];

  return (
    <div className="flex w-full items-center">
      <nav aria-label="Agent sections" className="flex items-center gap-3">
        {tabs.map(({ id, ...tab }) => (
          <TabLink key={id} {...tab} />
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <PanelToggleButtons hasMemory={hasMemory} />
        {rightSlot}
      </div>
    </div>
  );
}
