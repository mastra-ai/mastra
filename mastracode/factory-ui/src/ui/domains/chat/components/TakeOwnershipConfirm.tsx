import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';

import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { useTakeSessionOwnership } from '../../workspaces/hooks/useTakeSessionOwnership';
import { useChatTranscript } from '../context/useChatTranscript';
import { TakeoverBillingMessage } from './TakeoverBillingMessage';

export function TakeOwnershipConfirm({
  factoryId,
  session,
  onClose,
}: {
  factoryId: string;
  session: FactoryUserSession;
  onClose: () => void;
}) {
  const takeOwnership = useTakeSessionOwnership(factoryId);
  const { busy } = useChatTranscript();
  const ownerLabel = session.owner?.name ?? 'a teammate';

  return (
    <Notice
      variant="warning"
      title={`Take ${ownerLabel}’s session?`}
      action={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            autoFocus
            disabled={takeOwnership.isPending}
            onClick={onClose}
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
                { onSettled: onClose },
              )
            }
          >
            Take ownership
          </Button>
        </div>
      }
    >
      <TakeoverBillingMessage factoryId={factoryId} ownerLabel={ownerLabel} />
      {busy && <Notice.Message>The running agent stops.</Notice.Message>}
    </Notice>
  );
}
