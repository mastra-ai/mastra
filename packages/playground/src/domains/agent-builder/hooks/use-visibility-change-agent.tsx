import { DialogBody } from '@mastra/playground-ui';
import { useFormContext } from 'react-hook-form';

import { AgentImpactWarnings } from '../components/agent-edit/agent-impact-warnings';
import type { AgentBuilderEditFormValues } from '../schemas';
import { useVisibilityChangeDialog } from './use-visibility-change-dialog';
import type { UseVisibilityChangeDialogResult, VisibilityCopy } from './use-visibility-change-dialog';
import { useStoredAgentDependents, useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

type Visibility = NonNullable<AgentBuilderEditFormValues['visibility']>;

const COPY: Record<Visibility, VisibilityCopy> = {
  public: {
    title: 'Add this agent to your library?',
    description:
      'Adding this agent to the library means your teammates will be able to discover, view, and chat with it.',
    toast: 'Agent added to the library',
  },
  private: {
    title: 'Remove this agent from your library?',
    description:
      'Removing this agent from the library means your teammates will no longer be able to discover, view, or chat with it. You will be the only person with access.',
    toast: 'Agent removed from the library',
  },
};

export type UseVisibilityChange = UseVisibilityChangeDialogResult<Visibility>;

export function useVisibilityChange(agentId: string): UseVisibilityChange {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const { isLoading: isDependentsLoading } = useStoredAgentDependents(agentId);

  return useVisibilityChangeDialog<Visibility>({
    copy: COPY,
    isPending: updateStoredAgent.isPending,
    mutate: visibility => updateStoredAgent.mutateAsync({ visibility }),
    onSuccess: visibility => {
      formMethods.setValue('visibility', visibility, { shouldDirty: false });
    },
    testIds: {
      dialog: 'agent-builder-visibility-confirm-dialog',
      cancel: 'agent-builder-visibility-confirm-cancel',
      confirm: 'agent-builder-visibility-confirm-yes',
    },
    renderExtraContent: pending =>
      pending === 'private' ? (
        <DialogBody className="pt-0">
          <AgentImpactWarnings agentId={agentId} variant="make-private" />
        </DialogBody>
      ) : null,
    confirmDisabled: pending => pending === 'private' && isDependentsLoading,
  });
}
