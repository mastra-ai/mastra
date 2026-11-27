import type { ReactNode } from 'react';
import { buttonVariants } from '@/ds/components/Button/Button';
import { Txt } from '@/ds/components/Txt';
import { IconBranch } from '@/ds/icons/central/IconBranch';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { Icon } from '@/ds/icons/Icon';
import { TraceIcon } from '@/ds/icons/TraceIcon';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export type AgentTab = 'chat' | 'traces' | 'versions';

export interface AgentTabsProps {
  active: AgentTab;
  chatHref: string;
  tracesHref: string;
  versionsHref: string;
  actions?: ReactNode;
}

function Tab({ href, active, icon, label }: { href: string; active: boolean; icon: ReactNode; label: string }) {
  const { Link } = useLinkComponent();
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'md' }),
        'shrink-0 gap-1.5',
        active && 'bg-fill text-foreground',
      )}
    >
      <Icon size="xs">{icon}</Icon>
      <Txt as="span" variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Link>
  );
}

export function AgentTabs({ active, chatHref, tracesHref, versionsHref, actions }: AgentTabsProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 px-2 pt-1.5">
      <nav aria-label="Agent views" className="flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto">
        <Tab href={chatHref} active={active === 'chat'} icon={<IconChatBubble7 />} label="Chat" />
        <Tab href={tracesHref} active={active === 'traces'} icon={<TraceIcon />} label="Traces" />
        <Tab href={versionsHref} active={active === 'versions'} icon={<IconBranch />} label="Versions" />
      </nav>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
