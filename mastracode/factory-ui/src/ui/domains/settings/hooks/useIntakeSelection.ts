import { toast } from '@mastra/playground-ui/components/Toaster';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../api/keys';
import { useIntakeSelectionSaving, useSaveIntakeSelectionMutation } from '../../../../hooks/useIntakeConfig';
import type { IntakeConfig, IntakeSelection } from '../../factory/services/intake';

/** Edit one integration's intake selection from settings; each change shows at once and saves in the background. */
export function useIntakeSelection(integrationId: string) {
  const queryClient = useQueryClient();
  const save = useSaveIntakeSelectionMutation(integrationId, {
    onSaved: () => toast.success('Intake sources updated', { id: 'intake-sources-saved' }),
    onFailed: error => toast.error(error.message, { id: 'intake-sources-failed' }),
  });
  const saving = useIntakeSelectionSaving(integrationId);
  const update = (change: (current: IntakeSelection) => IntakeSelection) => {
    const current = queryClient.getQueryData<IntakeConfig>(queryKeys.intakeConfig())?.[integrationId];
    if (current) save.mutate(change(current));
  };
  return { update, saving };
}
