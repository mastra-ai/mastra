import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';

export function TeammateSessionLine() {
  const { sessionId, threadId } = useParams<{ sessionId?: string; threadId?: string }>();
  const session = useUserSessionQuery(sessionId ?? threadId).data;
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  return (
    <div className="flex min-w-0 items-center gap-2 px-3">
      {owner && (
        <div aria-hidden="true">
          <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted" className="truncate">
        You’re steering {owner ? `${owner.name}’s` : 'a teammate’s'} session
      </Txt>
    </div>
  );
}
