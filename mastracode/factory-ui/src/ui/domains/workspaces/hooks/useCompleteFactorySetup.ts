import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { availableModelsQueryOptions } from '../../../../hooks/useAvailableModels';
import { useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSetDefaultModel } from '../../../../hooks/use-default-model';
import {
  createFactoryProject,
  fetchFactoryProject,
  renameFactoryProject,
  unlinkRepository,
  updateFactoryDefaultModel,
} from '../services/github';
import {
  clearOnboardingFlow,
  persistOnboardingFactory,
  persistOnboardingLinkedRepositories,
  readOnboardingFactory,
  readOnboardingLinkedRepositories,
} from '../services/onboardingFlow';
import type { OnboardingDraft } from '../services/onboardingFlow';

async function findPendingFactory(baseUrl: string, pendingId: string) {
  try {
    return await fetchFactoryProject(baseUrl, pendingId);
  } catch (error) {
    if (error instanceof Error && 'status' in error && (error.status === 404 || error.status === 403)) return undefined;
    throw error;
  }
}

export function useCompleteFactorySetup() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const link = useLinkRepositoryMutation();
  const setPersonalDefault = useSetDefaultModel();
  return useMutation({
    mutationFn: async (draft: OnboardingDraft) => {
      const repo = draft.repository;
      if (!repo) throw new Error('Choose a repository before creating your factory.');
      const factoryModel = draft.model?.modelId ?? draft.personal?.modelId;
      if (!factoryModel) throw new Error('Choose a model before creating your factory.');
      const personalModel = draft.personal?.modelId;
      const availableModels = await queryClient.fetchQuery({ ...availableModelsQueryOptions(baseUrl), staleTime: 0 });
      const unavailableModel = [factoryModel, personalModel].find(
        modelId => modelId && !availableModels.some(available => available.id === modelId),
      );
      if (unavailableModel) throw new Error(`${unavailableModel} is no longer available. Choose another model.`);

      const pendingId = readOnboardingFactory();
      const existing = pendingId ? await findPendingFactory(baseUrl, pendingId) : undefined;
      const factory = existing ?? (await createFactoryProject(baseUrl, repo.name));
      // Linking refetches the Factory list; the marker keeps the root guard from leaving onboarding.
      persistOnboardingFactory(factory.id);
      if (existing && existing.name !== repo.name) await renameFactoryProject(baseUrl, factory.id, repo.name);
      const previouslyLinked = existing ? readOnboardingLinkedRepositories() : [];
      await link.mutateAsync({
        factoryProjectId: factory.id,
        repo,
        onLinked: async linked => {
          const onboardingLinks = [...new Set([...previouslyLinked, linked.projectRepositoryId])];
          // Record the new link before cleanup can fail, including across a reload and another repo choice.
          persistOnboardingLinkedRepositories(onboardingLinks);
          for (const id of onboardingLinks) {
            if (id !== linked.projectRepositoryId) await unlinkRepository(baseUrl, factory.id, id);
          }
          persistOnboardingLinkedRepositories([linked.projectRepositoryId]);
        },
      });
      await Promise.all([
        updateFactoryDefaultModel(baseUrl, factory.id, factoryModel),
        personalModel ? setPersonalDefault.mutateAsync(personalModel) : undefined,
      ]);
      return factory.id;
    },
    onSuccess: async factoryId => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      clearOnboardingFlow();
      void navigate(`/factories/${factoryId}`);
    },
  });
}
