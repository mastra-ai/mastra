import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';

import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { useTakeSessionOwnership } from '../../workspaces/hooks/useTakeSessionOwnership';
import { useChatTranscript } from '../context/useChatTranscript';
import { TakeoverBillingMessage } from './TakeoverBillingMessage';

export function TakeOwnershipDialog({ factoryId, session }: { factoryId: string; session: FactoryUserSession }) {
  const takeOwnership = useTakeSessionOwnership(factoryId);
  const { busy } = useChatTranscript();
  const ownerLabel = session.owner?.name ?? 'a teammate';

  return (
    <AlertDialog>
      <AlertDialog.Trigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0"
            disabled={takeOwnership.isPending}
          >
            Take ownership
          </Button>
        }
      />
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Take {ownerLabel}’s session?</AlertDialog.Title>
          <AlertDialog.Description>
            <TakeoverBillingMessage factoryId={factoryId} ownerLabel={ownerLabel} />
            {busy && ' The running agent stops.'}
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action
            onClick={() => takeOwnership.mutate({ sessionId: session.sessionId, expectedOwnerId: session.userId })}
          >
            Take ownership
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
