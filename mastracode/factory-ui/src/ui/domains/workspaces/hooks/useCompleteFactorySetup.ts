import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useApiConfig } from '../../../../api/config';
import { isProviderConnected } from './useProviderConnection';
import { queryKeys } from '../../../../api/keys';
import { availableModelsQueryOptions } from '../../../../hooks/useAvailableModels';
import { providersQueryOptions } from '../../../../hooks/use-providers';
import { useLinkRepositoryMutation } from '../../../../hooks/useFactories';
import { useSetDefaultModel } from '../../../../hooks/use-default-model';
import {
  createFactoryProject,
  deleteFactoryProject,
  fetchFactoryProject,
  renameFactoryProject,
  unlinkRepository,
  updateFactoryDefaultModel,
} from '../services/github';
import {
  clearOnboardingFlow,
  completeOnboardingSchema,
  onboardingModelPlan,
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

export function useCompleteFactorySetup({ local }: { local: boolean }) {
  const { baseUrl, client } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const link = useLinkRepositoryMutation();
  const setPersonalDefault = useSetDefaultModel();
  return useMutation({
    mutationFn: async (draft: OnboardingDraft) => {
      const parsed = completeOnboardingSchema.safeParse(draft);
      if (!parsed.success) throw new Error('Choose your setup and its required models before creating your factory.');
      const setup = parsed.data;
      const repo = setup.repository;
      const modelScope = setup.modelScope;
      const plan = onboardingModelPlan(setup);
      const [providers, catalogs] = await Promise.all([
        queryClient.fetchQuery({ ...providersQueryOptions(client), staleTime: 0 }),
        Promise.all(
          plan.checks.map(({ scope }) =>
            queryClient.fetchQuery({
              ...availableModelsQueryOptions(baseUrl, { scope }),
              staleTime: 0,
            }),
          ),
        ),
      ]);
      for (const [index, { scope, choice }] of plan.checks.entries()) {
        const account = scope === 'org' ? 'the company account' : 'your account';
        if (
          !catalogs[index].models.some(model => model.id === choice.modelId && model.provider === choice.providerId)
        ) {
          throw new Error(`${choice.modelId} is no longer available for ${account}. Choose another model.`);
        }
        const provider = providers.providers.find(item => item.provider === choice.providerId);
        if (!provider || !isProviderConnected(provider, local ? undefined : scope, choice.method)) {
          throw new Error(`The connection for ${account} has changed. Review your provider connection.`);
        }
      }

      const pendingId = readOnboardingFactory();
      let existing = pendingId ? await findPendingFactory(baseUrl, pendingId) : undefined;
      if (existing && existing.modelScope !== modelScope) {
        // Recreate the unfinished project rather than bypassing the admin gate on scope changes.
        await deleteFactoryProject(baseUrl, existing.id);
        existing = undefined;
      }
      const factory = existing ?? (await createFactoryProject(baseUrl, repo.name, undefined, modelScope));
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
        updateFactoryDefaultModel(baseUrl, factory.id, plan.factoryModelId),
        plan.personalModelId ? setPersonalDefault.mutateAsync(plan.personalModelId) : undefined,
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
