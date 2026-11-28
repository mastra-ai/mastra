import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useSessionHost } from '../context/SessionHostContext';

import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { isFactoryOwnedSession } from '../../workspaces/services/sessionPresentation';
import type { SessionOwnershipLock } from '@internal/factory-contract';
import { useChatModelScope } from '../context/useChatModelScope';
import { TakeOwnershipDialog } from './TakeOwnershipDialog';

function lockReason(lock: SessionOwnershipLock, organizationKeys: boolean): string {
  switch (lock) {
    case 'card':
      return organizationKeys ? 'Card work stays on the organization’s keys' : 'Card sessions keep their owner';
    case 'slack-thread':
      return 'Slack thread sessions keep their owner';
    case 'side-session':
      return 'Side sessions keep their owner';
    default:
      return lock satisfies never;
  }
}

export function TeammateSessionLine() {
  const { factoryProjectId: factoryId, data } = useSessionHost();
  const session = data.useUserSession(useRouteSessionId()).data;
  const viewerUserId = data.useViewer().data?.user?.userId;
  const { modelScope } = useChatModelScope();
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  const canTakeOwnership = session.capabilities?.takeOwnership === true && factoryId !== undefined;
  const lock = session.capabilities?.ownershipLock;
  const steering = isFactoryOwnedSession(session)
    ? 'You’re steering the Factory’s session'
    : `You’re steering ${owner?.name ?? 'a teammate'}’s session`;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {owner && (
        <div aria-hidden="true">
          <Avatar name={owner.name} src={owner.avatarUrl} size="xs" />
        </div>
      )}
      <Txt as="p" variant="caption" tone="muted" className="truncate">
        {lock ? `${steering}. ${lockReason(lock, modelScope === 'factory')}.` : steering}
      </Txt>
      {canTakeOwnership && <TakeOwnershipDialog factoryId={factoryId} session={session} />}
    </div>
  );
}
