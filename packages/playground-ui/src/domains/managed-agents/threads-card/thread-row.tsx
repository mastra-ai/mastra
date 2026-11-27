import type { ReactNode } from 'react';
import { Avatar } from '@/ds/components/Avatar';
import { Txt } from '@/ds/components/Txt';
import { IconLock } from '@/ds/icons/central/IconLock';
import { Icon } from '@/ds/icons/Icon';

export interface ThreadRowAgent {
  name: string;
  avatar?: string;
}

export interface ThreadRowProps {
  href: string;
  title: ReactNode;
  updated: ReactNode;
  agents: ThreadRowAgent[];
  current?: boolean;
  private?: boolean;
}

export function ThreadRow({ href, title, updated, agents, current, private: isPrivate }: ThreadRowProps) {
  return (
    <li>
      <a
        href={href}
        aria-current={current ? 'page' : undefined}
        className="flex items-center gap-2 rounded-lg p-1.5 text-muted-foreground hover:bg-fill-subtle aria-[current=page]:bg-fill aria-[current=page]:text-foreground"
      >
        <Avatar.Group size="inline" className="shrink-0">
          {agents.map(agent => (
            <Avatar key={agent.name} name={agent.name} src={agent.avatar} size="inline" />
          ))}
        </Avatar.Group>
        <Txt as="span" variant="body-sm" className="min-w-0 flex-1 truncate">
          {title}
        </Txt>
        {isPrivate ? (
          <span role="img" aria-label="Private" title="Private" className="shrink-0 text-subtle-foreground">
            <Icon size="xs">
              <IconLock />
            </Icon>
          </span>
        ) : null}
        <Txt as="span" variant="caption" tone="muted" className="shrink-0 tabular-nums">
          {updated}
        </Txt>
      </a>
    </li>
  );
}
