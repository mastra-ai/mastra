import { toast } from '@mastra/playground-ui/components/Toaster';

import { useSaveFactoryEnvironmentMutation } from '../../../../../hooks/useFactoryEnvironment';
import type { SaveEnvironment } from './CommittedInput';

export function useEnvironmentSave(factoryId: string) {
  const saveMutation = useSaveFactoryEnvironmentMutation();

  // Resolves either way: callers fire and forget, the toast carries the failure.
  const save: SaveEnvironment = input =>
    saveMutation
      .mutateAsync(
        { factoryId, input },
        {
          onSuccess: () => toast.success('Environment saved'),
          onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save environment'),
        },
      )
      .then(
        () => true,
        () => false,
      );

  return { save, disabled: saveMutation.isPending };
}
