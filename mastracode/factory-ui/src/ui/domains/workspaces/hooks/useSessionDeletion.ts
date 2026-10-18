import { useState } from 'react';

import { useDeleteUserSessionMutation, useDeleteWorkspaceMutation } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { SessionListRow } from '../services/sessionRows';

export function useSessionDeletion(factoryId: string | undefined, resourceId: string) {
  const [pendingConfirmation, setPendingConfirmation] = useState<SessionListRow>();
  const deleteWorkspace = useDeleteWorkspaceMutation(factoryId, { agentControllerId: AGENT_CONTROLLER_ID, resourceId });
  const deleteUserSession = useDeleteUserSessionMutation(factoryId);
  const cancel = () => setPendingConfirmation(undefined);

  const confirm = () => {
    if (!pendingConfirmation) return;
    if (pendingConfirmation.origin === 'factory') {
      deleteWorkspace.mutate(pendingConfirmation.session, { onSuccess: cancel });
    } else {
      deleteUserSession.mutate(pendingConfirmation.session, { onSettled: cancel });
    }
  };

  return {
    pendingConfirmation,
    deleting: deleteWorkspace.isPending || deleteUserSession.isPending,
    requestDeletion: (row: SessionListRow) => setPendingConfirmation(row),
    cancel,
    confirm,
  };
}
