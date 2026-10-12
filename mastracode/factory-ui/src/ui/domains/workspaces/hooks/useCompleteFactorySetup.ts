import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSetDefaultModel } from '../../../../hooks/use-default-model';
import {
  createFactoryProject,
  listFactoryProjects,
  renameFactoryProject,
  unlinkRepository,
  updateFactoryDefaultModel,
} from '../services/github';
import { clearOnboardingFlow, persistOnboardingFactory, readOnboardingFactory } from '../services/onboardingFlow';
import type { OnboardingDraft } from '../services/onboardingFlow';

async function findPendingFactory(baseUrl: string, pendingId: string) {
  const factories = await listFactoryProjects(baseUrl);
  if (!factories) throw new Error('Unable to load your factories. Please try again.');
  return factories.find(factory => factory.id === pendingId);
}

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
      const factoryModel = draft.model?.modelId ?? draft.personal?.modelId;
      if (!factoryModel) throw new Error('Choose a model before creating your factory.');
      const pendingId = readOnboardingFactory();
      const existing = pendingId ? await findPendingFactory(baseUrl, pendingId) : undefined;
      const factory = existing ?? (await createFactoryProject(baseUrl, repo.name));
      // Linking refetches the Factory list; the marker keeps the root guard from leaving onboarding.
      persistOnboardingFactory(factory.id);
      if (existing && existing.name !== repo.name) await renameFactoryProject(baseUrl, factory.id, repo.name);
      const linked = await link.mutateAsync({ factoryProjectId: factory.id, repo });
      for (const previous of existing?.repositories ?? []) {
        if (previous.projectRepositoryId !== linked.projectRepositoryId) {
          await unlinkRepository(baseUrl, factory.id, previous.projectRepositoryId);
        }
      }
      const personalModel = draft.personal?.modelId;
      await Promise.all([
        updateFactoryDefaultModel(baseUrl, factory.id, factoryModel),
        personalModel && setPersonalDefault.mutateAsync(personalModel),
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
