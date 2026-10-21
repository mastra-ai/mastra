import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { useTakeSessionOwnership } from '../../workspaces/hooks/useTakeSessionOwnership';

export function TeammateSessionLine() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId?: string; sessionId?: string; threadId?: string }>();
  const session = useUserSessionQuery(sessionId ?? threadId).data;
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const takeOwnership = useTakeSessionOwnership(factoryId);
  const [confirming, setConfirming] = useState(false);
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  const ownersSession = `${owner ? `${owner.name}’s` : 'a teammate’s'} session`;
  const canTakeOwnership = session.capabilities?.takeOwnership === true;
  if (confirming && canTakeOwnership) {
    return (
      <Notice
        variant="warning"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              autoFocus
              disabled={takeOwnership.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={takeOwnership.isPending}
              onClick={() =>
                takeOwnership.mutate(
                  { sessionId: session.sessionId, expectedOwnerId: session.userId },
                  { onSettled: () => setConfirming(false) },
                )
              }
            >
              Take ownership
            </Button>
          </div>
        }
      >
        <Notice.Message>Take {ownersSession}? Its next turn runs as you, and a running agent stops.</Notice.Message>
      </Notice>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-3">
      {owner && (
        <div aria-hidden="true">
          <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted" className="truncate">
        You’re steering {ownersSession}
      </Txt>
      {canTakeOwnership && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto shrink-0"
          onClick={() => setConfirming(true)}
        >
          Take ownership
        </Button>
      )}
    </div>
  );
}
