import { toast } from '@mastra/playground-ui/components/Toaster';

import { useSaveFactoryEnvironmentMutation } from '../../../../../hooks/useFactoryEnvironment';
import type { SaveEnvironment } from './CommittedInput';

export function useEnvironmentSave(factoryId: string) {
  const mutation = useSaveFactoryEnvironmentMutation();
  const save: SaveEnvironment = input =>
    mutation.mutateAsync({ factoryId, input }).then(
      () => {
        toast.success('Environment saved');
        return true;
      },
      error => {
        toast.error(error instanceof Error ? error.message : 'Failed to save environment');
        return false;
      },
    );

  return { save, disabled: mutation.isPending };
}
