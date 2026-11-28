import type { ReactNode } from 'react';
import { AgentTabLink } from './agent-tab-link';
import { IconBranch } from '@/ds/icons/central/IconBranch';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { TraceIcon } from '@/ds/icons/TraceIcon';

export type AgentTab = 'chat' | 'traces' | 'versions';

export interface AgentTabsProps {
  active: AgentTab;
  chatHref: string;
  tracesHref: string;
  versionsHref: string;
  actions?: ReactNode;
}

export function AgentTabs({ active, chatHref, tracesHref, versionsHref, actions }: AgentTabsProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 px-2 pt-1.5">
      <nav aria-label="Agent views" className="flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto">
        <AgentTabLink href={chatHref} active={active === 'chat'} icon={<IconChatBubble7 />} label="Chat" />
        <AgentTabLink href={tracesHref} active={active === 'traces'} icon={<TraceIcon />} label="Traces" />
        <AgentTabLink href={versionsHref} active={active === 'versions'} icon={<IconBranch />} label="Versions" />
      </nav>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
