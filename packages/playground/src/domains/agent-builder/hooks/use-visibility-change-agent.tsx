import { useFormContext } from 'react-hook-form';

import type { AgentBuilderEditFormValues } from '../schemas';
import { useVisibilityChangeDialog } from './use-visibility-change-dialog';
import type { UseVisibilityChangeDialogResult, VisibilityCopy } from './use-visibility-change-dialog';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

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
  });
}
