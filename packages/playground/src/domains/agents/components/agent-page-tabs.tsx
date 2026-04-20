import { Txt, Icon, Tooltip, TooltipContent, TooltipTrigger, cn, IconButton } from '@mastra/playground-ui';
import { ExternalLink, EyeIcon, FlaskConical, MessageSquare, ClipboardCheck, GitBranch, PanelRight, PanelRightClose } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';

export type AgentPageTab = 'chat' | 'versions' | 'evaluate' | 'review' | 'traces';

interface AgentPageTabsProps {
  agentId: string;
  activeTab: AgentPageTab;
  showPlayground?: boolean;
  showObservability?: boolean;
  reviewBadge?: number;
  rightSlot?: React.ReactNode;
  showAgentInfo?: boolean;
  onToggleAgentInfo?: () => void;
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

function TabLink({
  href,
  active,
  icon,
  label,
  badge,
  disabled,
  disabledReason,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
}) {
  const { navigate } = useLinkComponent();

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-neutral2 cursor-not-allowed opacity-50">
            <Icon size="sm">{icon}</Icon>
            <Txt variant="ui-sm" className="text-inherit">
              {label}
            </Txt>
          </span>
        </TooltipTrigger>
        {disabledReason && <TooltipContent side="bottom">{disabledReason}</TooltipContent>}
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
        active
          ? 'bg-surface4 text-neutral5'
          : 'bg-transparent text-neutral3 hover:bg-surface3 hover:text-neutral5',
      )}
    >
      <Icon size="sm">{icon}</Icon>
      <Txt variant="ui-sm" className="text-inherit">
        {label}
      </Txt>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 bg-accent1 text-white text-xs font-medium rounded-full px-1.5 py-0 min-w-[18px] text-center leading-[18px]">
          {badge}
        </span>
      )}
    </button>
  );
}

export function AgentPageTabs({
  agentId,
  activeTab,
  showPlayground = false,
  showObservability = false,
  reviewBadge,
  rightSlot,
  showAgentInfo,
  onToggleAgentInfo,
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

  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <TabLink
        href={`/agents/${agentId}/chat/new`}
        active={activeTab === 'chat'}
        icon={<MessageSquare />}
        label="Chat"
      />
      <TabLink
        href={`/agents/${agentId}/editor`}
        active={activeTab === 'versions'}
        icon={<GitBranch />}
        label="Editor"
        disabled={!showPlayground}
        disabledReason={playgroundDisabledReason}
      />
      <TabLink
        href={`/agents/${agentId}/evaluate`}
        active={activeTab === 'evaluate'}
        icon={<FlaskConical />}
        label="Evaluate"
        disabled={!showObservability}
        disabledReason={observabilityDisabledReason}
      />
      <TabLink
        href={`/agents/${agentId}/review`}
        active={activeTab === 'review'}
        icon={<ClipboardCheck />}
        label="Review"
        badge={reviewBadge}
        disabled={!showObservability}
        disabledReason={observabilityDisabledReason}
      />
      <TabLink
        href={`/agents/${agentId}/traces`}
        active={activeTab === 'traces'}
        icon={<EyeIcon />}
        label="Traces"
        disabled={!showObservability}
        disabledReason={observabilityDisabledReason}
      />
      <div className="ml-auto flex items-center gap-2">
        {rightSlot}
        {onToggleAgentInfo && (
          <IconButton
            tooltip={showAgentInfo ? 'Hide agent info' : 'Show agent info'}
            onClick={onToggleAgentInfo}
            variant="ghost"
            size="sm"
          >
            {showAgentInfo ? <PanelRightClose /> : <PanelRight />}
          </IconButton>
        )}
      </div>
    </div>
  );
}
