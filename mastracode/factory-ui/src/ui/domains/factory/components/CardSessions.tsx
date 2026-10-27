import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { CardContextSession } from '../boardItems';

/** The card's sessions, one per context, each opening its own thread. */
export function CardSessions({ factoryId, sessions }: { factoryId: string; sessions: readonly CardContextSession[] }) {
  const running = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: sessions.map(session => session.ref.sessionId),
  });
  if (sessions.length === 0) return null;

  return (
    <section aria-label="Sessions" className="flex flex-col gap-1">
      <Txt as="h4" variant="eyebrow" tone="muted" className="m-0">
        Sessions
      </Txt>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {sessions.map(session => {
          const live = running[session.ref.sessionId] === true;
          return (
            <li key={session.context}>
              <Link
                to={`/factories/${factoryId}/workspaces/${session.ref.sessionId}/threads/${session.ref.threadId}`}
                className="hover:bg-fill-hover flex items-center gap-2 rounded-md px-1.5 py-1"
              >
                <span
                  aria-hidden
                  className={live ? 'bg-success-indicator size-1.5 rounded-full' : 'bg-fill size-1.5 rounded-full'}
                />
                <Txt as="span" variant="body-sm" tone="ink" className="truncate">
                  {session.label}
                </Txt>
                <Txt as="span" variant="caption" tone="muted" className="ml-auto shrink-0">
                  {[session.current ? 'current' : undefined, live ? 'running' : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
