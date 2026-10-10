import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSetDefaultModel } from '../../../../hooks/use-default-model';
import { usesPersonalFactoryModel } from '../services/onboardingModelChoice';
import {
  createFactoryProject,
  listFactoryProjects,
  renameFactoryProject,
  unlinkRepository,
  updateFactoryDefaultModel,
} from '../services/github';
import {
  clearOnboardingFlow,
  ONBOARDING_FACTORY_KEY,
  persistOnboardingFactory,
  persistOnboardingStep,
} from '../services/onboardingFlow';
import type { OnboardingDraft } from '../services/onboardingFlow';

/** Commit once the user confirms. Keep the created id so failed saves can be retried. */
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
      const factoryModel = usesPersonalFactoryModel(draft) ? draft.personal?.modelId : draft.model?.modelId;
      if (!factoryModel) throw new Error('Choose a model before creating your factory.');
      persistOnboardingStep('review');
      const pendingId = sessionStorage.getItem(ONBOARDING_FACTORY_KEY);
      const factories = await listFactoryProjects(baseUrl);
      if (!factories) throw new Error('Unable to load your factories. Please try again.');
      const existing = factories.find(factory => factory.id === pendingId);
      const factory = existing ?? (await createFactoryProject(baseUrl, repo.name));
      // Set the routing marker before anything refetches the Factory list.
      persistOnboardingFactory(factory.id);
      if (existing && existing.name !== repo.name) await renameFactoryProject(baseUrl, factory.id, repo.name);
      const linked = await link.mutateAsync({ factoryProjectId: factory.id, repo });
      // A failed confirmation (or an older wizard) may have linked a previous choice.
      // Replace only this pending Factory's links, after the new one succeeds.
      for (const previous of existing?.repositories ?? []) {
        if (previous.projectRepositoryId !== linked.projectRepositoryId) {
          await unlinkRepository(baseUrl, factory.id, previous.projectRepositoryId);
        }
      }
      await updateFactoryDefaultModel(baseUrl, factory.id, factoryModel);
      // Observer/Reflector remain Auto. Explicit existing role choices stay untouched.
      if (draft.personal?.modelId) {
        await setPersonalDefault.mutateAsync(draft.personal.modelId);
      }
      return factory.id;
    },
    onSuccess: async factoryId => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      clearOnboardingFlow();
      void navigate(`/factories/${factoryId}`);
    },
  });
}
