import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { Link } from 'react-router';

import { useActiveRunResourceIds } from '../../../../hooks/useActiveRunResources';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { CardContextSession } from '../boardItems';

/** Every session the card holds, named by the context it runs in, the current one first. */
export function CardSessions({ factoryId, sessions }: { factoryId: string; sessions: readonly CardContextSession[] }) {
  const running = useActiveRunResourceIds(AGENT_CONTROLLER_ID);
  if (sessions.length === 0) return null;

  return (
    <section aria-label="Sessions" className="flex flex-col gap-1">
      <Txt as="h4" variant="eyebrow" tone="muted" className="m-0">
        Sessions
      </Txt>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {sessions.map(session => {
          const live = running.has(session.ref.sessionId);
          const caption = [session.current && 'current', live && 'running'].filter(Boolean).join(' · ');
          return (
            <li key={session.context}>
              <Link
                to={`/factories/${factoryId}/workspaces/${session.ref.sessionId}/threads/${session.ref.threadId}`}
                className={`hover:bg-fill-hover flex items-center gap-2 rounded-sm px-1 py-0.5 ${focusRing}`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full ${live ? 'bg-badge-green-indicator' : 'bg-border'}`}
                />
                <Txt as="span" variant="meta" tone="ink" className="min-w-0 flex-1 truncate">
                  {session.label}
                </Txt>
                {caption && (
                  <Txt as="span" variant="caption" tone="muted">
                    {caption}
                  </Txt>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
