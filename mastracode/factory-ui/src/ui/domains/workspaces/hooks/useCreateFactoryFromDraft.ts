import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useApplyProviderOMDefaults } from '../../../../hooks/use-om';
import { useCreateFactoryMutation, useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSaveIntakeBindingMutation, useSaveIntakeConfigMutation } from '../../../../hooks/useIntakeConfig';
import { fetchIntakeConfig, selectIntakeSource } from '../../factory/services/intake';
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
 * The wizard's single write: create the Factory, link the repository, feed its
 * issue intake (plus the Linear project when one was picked), and save the
 * model its runs start on. Nothing before this touches the server, so an
 * abandoned wizard leaves nothing behind.
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

  // One config write for both sources — two read-modify-writes would drop
  // each other's selection.
  const feedBoard = async (repositorySlug: string, linear?: { sourceId: string; factoryProjectId: string }) => {
    if (linear) {
      await saveIntakeBinding.mutateAsync({
        integrationId: 'linear',
        sourceId: linear.sourceId,
        factoryProjectId: linear.factoryProjectId,
      });
    }
    const config = await fetchIntakeConfig(baseUrl);
    const githubSelection = selectIntakeSource(config.github, repositorySlug);
    const linearSelection = linear ? selectIntakeSource(config.linear, linear.sourceId) : config.linear;
    if (githubSelection === config.github && linearSelection === config.linear) return;
    await saveIntakeConfig.mutateAsync({ ...config, github: githubSelection, linear: linearSelection });
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

      const linearPick = draft.linearProjectId
        ? { sourceId: draft.linearProjectId, factoryProjectId: factory.id }
        : undefined;
      await Promise.all([
        updateFactoryDefaultModel(baseUrl, factory.id, modelId),
        applyOMDefaults.mutateAsync({ providerId, factoryModelId: modelId, factoryId: factory.id }),
        feedBoard(draft.repository.fullName, linearPick),
      ]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      await onCreated(factory);
    },
  });
}
