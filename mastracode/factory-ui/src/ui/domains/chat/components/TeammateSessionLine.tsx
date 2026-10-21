import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { TakeOwnershipConfirm } from './TakeOwnershipConfirm';

export function TeammateSessionLine() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId?: string; sessionId?: string; threadId?: string }>();
  const session = useUserSessionQuery(sessionId ?? threadId).data;
  const viewerUserId = useFactoryAuth().data?.user?.userId;
  const [confirming, setConfirming] = useState(false);
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  const canTakeOwnership = session.capabilities?.takeOwnership === true;
  const confirmingTakeover = confirming && canTakeOwnership && factoryId !== undefined;
  if (confirmingTakeover) {
    return <TakeOwnershipConfirm factoryId={factoryId} session={session} onClose={() => setConfirming(false)} />;
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-3">
      {owner && (
        <div aria-hidden="true">
          <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted" className="truncate">
        You’re steering {owner?.name ?? 'a teammate'}’s session
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
