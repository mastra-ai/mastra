import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronDown } from 'lucide-react';
import { Link } from 'react-router';

import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { CardContextSession } from '../boardItems';

export function cardSessionPath(factoryId: string, session: CardContextSession): string {
  return `/factories/${factoryId}/workspaces/${session.ref.sessionId}/threads/${session.ref.threadId}`;
}

/** Switches between the card's sessions, one per context, from the breadcrumb. */
export function SessionContextMenu({
  factoryId,
  sessions,
  openSessionId,
}: {
  factoryId: string;
  sessions: readonly CardContextSession[];
  openSessionId: string;
}) {
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label="Switch session">
        <ChevronDown aria-hidden />
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
              {open ? <Check aria-hidden /> : null}
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
