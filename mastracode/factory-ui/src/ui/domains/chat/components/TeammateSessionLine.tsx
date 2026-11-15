import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { isFactoryOwnedSession } from '../../workspaces/services/sessionPresentation';
import { TakeOwnershipDialog } from './TakeOwnershipDialog';

export function TeammateSessionLine() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId?: string; sessionId?: string; threadId?: string }>();
  const session = useUserSessionQuery(sessionId ?? threadId).data;
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  const canTakeOwnership = session.capabilities?.takeOwnership === true && factoryId !== undefined;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {owner && (
        <div aria-hidden="true">
          <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted" className="truncate">
        {isFactoryOwnedSession(session)
          ? 'You’re steering the Factory’s session'
          : `You’re steering ${owner?.name ?? 'a teammate'}’s session`}
      </Txt>
      {canTakeOwnership && <TakeOwnershipDialog factoryId={factoryId} session={session} />}
    </div>
  );
}
