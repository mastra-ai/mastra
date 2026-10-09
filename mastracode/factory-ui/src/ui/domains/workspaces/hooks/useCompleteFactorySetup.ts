import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSetDefaultModel } from '../../../../hooks/use-default-model';
import { includesPersonalSetup } from '../services/modelSetupPreset';
import type { SaveModelSetupPreset } from '../services/modelSetupPreset';
import { readJsonOrThrow } from '../services/http';
import {
  createFactoryProject,
  listFactoryProjects,
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
export function useCompleteFactorySetup(savePreset?: SaveModelSetupPreset) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const link = useLinkRepositoryMutation();
  const setPersonalDefault = useSetDefaultModel();
  return useMutation({
    mutationFn: async (draft: OnboardingDraft) => {
      const repo = draft.repository;
      if (!repo) throw new Error('Choose a repository before creating your factory.');
      if (draft.preset && !savePreset) throw new Error('Model setup presets are not available on this deployment.');
      if (draft.preset?.kind === 'company' && !draft.model)
        throw new Error('Choose a shared model before creating your factory.');
      if (draft.preset?.kind === 'individual' && !draft.personal?.modelId)
        throw new Error('Choose your personal model before creating your factory.');
      persistOnboardingStep('review');
      const pendingId = sessionStorage.getItem(ONBOARDING_FACTORY_KEY);
      const factories = await listFactoryProjects(baseUrl);
      if (!factories) throw new Error('Unable to load your factories. Please try again.');
      const existing = factories.find(factory => factory.id === pendingId);
      const factory = existing ?? (await createFactoryProject(baseUrl, repo.name));
      // Set the routing marker before anything refetches the Factory list.
      persistOnboardingFactory(factory.id);
      if (existing && existing.name !== repo.name) {
        const response = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factory.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: repo.name }),
        });
        await readJsonOrThrow(response, 'Failed to update Factory name');
      }
      const linked = await link.mutateAsync({ factoryProjectId: factory.id, repo });
      // A failed confirmation (or an older wizard) may have linked a previous choice.
      // Replace only this pending Factory's links, after the new one succeeds.
      for (const previous of existing?.repositories ?? []) {
        if (previous.projectRepositoryId !== linked.projectRepositoryId) {
          await unlinkRepository(baseUrl, factory.id, previous.projectRepositoryId);
        }
      }
      const factoryModel = draft.preset?.kind === 'individual' ? draft.personal?.modelId : draft.model?.modelId;
      if (factoryModel) {
        await updateFactoryDefaultModel(baseUrl, factory.id, factoryModel);
        // Observer/Reflector remain Auto. Explicit existing role choices stay untouched.
      } else if (existing?.defaultModelId) {
        await updateFactoryDefaultModel(baseUrl, factory.id, null);
      }
      if (draft.personal?.modelId && (!draft.preset || includesPersonalSetup(draft.preset))) {
        await setPersonalDefault.mutateAsync(draft.personal.modelId);
      }
      // Only the preview supplies this checklist adapter. It never changes routing or permissions.
      if (draft.preset && savePreset) await savePreset(factory.id, draft.preset);
      return factory.id;
    },
    onSuccess: async factoryId => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
      clearOnboardingFlow();
      void navigate(`/factories/${factoryId}`);
    },
  });
}
