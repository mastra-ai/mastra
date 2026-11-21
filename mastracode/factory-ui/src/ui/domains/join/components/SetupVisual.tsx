import type { ProviderInfo } from '../../../../api/types';
import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { credentialAt } from '../../settings/components/provider-credential';
import { OnboardingPreview } from '../../workspaces/components/onboarding/preview/OnboardingPreview';
import type { FactoryModelScope } from '../../workspaces/services/github';

function previewLane(
  providers: readonly ProviderInfo[] | undefined,
  modelId: string | undefined,
  scope: 'org' | 'user',
) {
  const providerId = modelId?.split('/')[0];
  const provider = providers?.find(entry => entry.provider === providerId);
  return { providerId, method: provider ? credentialAt(provider, scope) : undefined, modelId };
}

/** Onboarding's routing diagram: the company lane from the Factory's default, the member's from theirs. */
export function SetupVisual({ factoryId, modelScope }: { factoryId: string; modelScope: FactoryModelScope }) {
  const project = useFactoryProjectQuery(factoryId);
  const providers = useProvidersQuery();
  const personalDefault = useDefaultModelQuery();
  const company = previewLane(providers.data, project.data?.defaultModelId ?? undefined, 'org');
  const personal = previewLane(providers.data, personalDefault.data?.modelId ?? undefined, 'user');
  return (
    <OnboardingPreview
      step="model"
      modelScope={modelScope}
      providerId={company.providerId}
      connectionMethod={company.method}
      model={company.modelId}
      personalProviderId={personal.providerId}
      personalConnectionMethod={personal.method}
      personalModel={personal.modelId}
    />
  );
}
