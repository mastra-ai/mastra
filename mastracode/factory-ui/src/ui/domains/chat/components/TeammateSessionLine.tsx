import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { useTakeSessionOwnership } from '../../workspaces/hooks/useTakeSessionOwnership';

export function TeammateSessionLine() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId?: string; sessionId?: string; threadId?: string }>();
  const session = useUserSessionQuery(sessionId ?? threadId).data;
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const takeOwnership = useTakeSessionOwnership(factoryId);
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto shrink-0"
        disabled={takeOwnership.isPending}
        onClick={() => takeOwnership.mutate({ sessionId: session.sessionId, expectedOwnerId: session.userId })}
      >
        Take ownership
      </Button>
    </div>
  );
}
