import type { SessionOwnershipLock } from '@internal/factory-contract';
import { useRouteSessionId, useSessionHost } from '../context/SessionHostContext';
import { useChatModelScope } from '../context/useChatModelScope';

import { isFactoryOwnedSession } from '../services/sessionPresentation';
import { TakeOwnershipDialog } from './TakeOwnershipDialog';
import { Avatar } from '@/ds/components/Avatar';
import { Txt } from '@/ds/components/Txt';

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
  // The host's data hooks are fixed for its lifetime, so this optional hook runs on every render or none.
  const takeOwnership = data.useTakeSessionOwnership?.(factoryId);
  const { modelScope } = useChatModelScope();
  if (!session || !viewerUserId || session.userId === viewerUserId) return null;

  const owner = session.owner;
  const canTakeOwnership =
    session.capabilities?.takeOwnership === true && factoryId !== undefined && takeOwnership !== undefined;
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
      {canTakeOwnership && (
        <TakeOwnershipDialog factoryId={factoryId} session={session} takeOwnership={takeOwnership} />
      )}
    </div>
  );
}
