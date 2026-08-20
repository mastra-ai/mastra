import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useApplyProviderOMDefaults } from '../../../../hooks/use-om';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSaveIntakeBindingMutation, useSaveIntakeConfigMutation } from '../../../../hooks/useIntakeConfig';
import { fetchIntakeConfig } from '../../factory/services/intake';
import { updateFactoryDefaultModel } from '../services/github';
import type { FactoryProjectPayload } from '../services/github';
import type { CreateFactoryDraft } from './useCreateFactoryFlow';

export interface CreateFactoryFromDraftOptions {
  draft?: CreateFactoryDraft;
  /** Persisted as each stage lands, so a failed attempt resumes instead of duplicating. */
  onFactoryCreated: (factory: FactoryProjectPayload) => Promise<unknown>;
  onRepositoryLinked: (linkedRepositoryId: string) => Promise<unknown>;
  onCreated: (factory: FactoryProjectPayload) => Promise<unknown>;
}

/**
 * The wizard's single write: create the Factory, link the repository, route the
 * Linear project when one was picked, and save the model its runs start on.
 * Nothing before this touches the server, so an abandoned wizard leaves nothing
 * behind.
 */
export function useCreateFactoryFromDraft({
  draft,
  onFactoryCreated,
  onRepositoryLinked,
  onCreated,
}: CreateFactoryFromDraftOptions) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const createFactory = useCreateFactoryMutation();
  const linkRepository = useLinkRepositoryMutation();
  const applyOMDefaults = useApplyProviderOMDefaults();
  const saveIntakeBinding = useSaveIntakeBindingMutation();
  const saveIntakeConfig = useSaveIntakeConfigMutation();

  /** Route a Linear project to the new board, and turn its sync on if it was off. */
  const feedBoardFromLinear = async (linearProjectId: string, factoryProjectId: string) => {
    await saveIntakeBinding.mutateAsync({ integrationId: 'linear', sourceId: linearProjectId, factoryProjectId });
    const config = await fetchIntakeConfig(baseUrl);
    const { enabled, sourceIds } = config.linear;
    const nextSourceIds =
      sourceIds === null || sourceIds.includes(linearProjectId) ? sourceIds : [...sourceIds, linearProjectId];
    if (enabled && nextSourceIds === sourceIds) return;
    await saveIntakeConfig.mutateAsync({ ...config, linear: { enabled: true, sourceIds: nextSourceIds } });
  };

  return useMutation({
    mutationFn: async ({ providerId, modelId }: { providerId: string; modelId: string }) => {
      if (!draft?.name || !draft.repository) throw new Error('Start over from the name step.');

      const factory = draft.factoryId
        ? { id: draft.factoryId, name: draft.name }
        : await createFactory.mutateAsync({ name: draft.name });
      if (!draft.factoryId) await onFactoryCreated(factory);

      if (!draft.linkedRepositoryId) {
        const linked = await linkRepository.mutateAsync({ factoryProjectId: factory.id, repo: draft.repository });
        await onRepositoryLinked(linked.projectRepositoryId);
      }

      await Promise.all([
        updateFactoryDefaultModel(baseUrl, factory.id, modelId),
        applyOMDefaults.mutateAsync({ providerId, factoryModelId: modelId, factoryId: factory.id }),
        draft.linearProjectId && feedBoardFromLinear(draft.linearProjectId, factory.id),
      ]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      await onCreated(factory);
    },
  });
}
