import type { CardContextSession } from '@mastra/factory/work-items/card-context-sessions';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import { useSessionActivityQuery } from '../../../../hooks/useSessionRows';
import type { WorkItemSessionRef } from '../services/workItems';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconChevronDownMedium } from '@mastra/playground-ui/icons/central/IconChevronDownMedium';

export function cardSessionPath(factoryId: string, session: CardContextSession<WorkItemSessionRef>): string {
  return `/factories/${factoryId}/workspaces/${session.ref.sessionId}/threads/${session.ref.threadId}`;
}

export function SessionContextMenu({
  factoryId,
  sessions,
  openSessionId,
}: {
  factoryId: string;
  sessions: readonly CardContextSession<WorkItemSessionRef>[];
  openSessionId: string;
}) {
  const running = new Set(useSessionActivityQuery(factoryId).data?.runningSessionIds);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label="Switch session">
        <IconChevronDownMedium aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-48">
        {sessions.map(session => {
          const live = running.has(session.ref.sessionId);
          const open = session.ref.sessionId === openSessionId;
          const name = [session.label, session.current && 'current phase', live && 'running', open && 'open']
            .filter(Boolean)
            .join(', ');
          return (
            <DropdownMenu.Item
              key={session.context}
              aria-label={name}
              render={<Link to={cardSessionPath(factoryId, session)} />}
            >
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${live ? 'bg-badge-green-indicator' : 'bg-border'}`}
              />
              <span className="min-w-0 flex-1 truncate">{session.label}</span>
              {session.current && (
                <Txt as="span" variant="caption" tone="muted">
                  current
                </Txt>
              )}
              {open ? <IconCheckmark2Medium aria-hidden /> : null}
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
