import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProvidersQuery } from '../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import { providerCredentialMethod } from '../hooks/useProviderConnection';
import type { OnboardingPreviewProps } from './OnboardingPreview';
import { OnboardingModelLabel } from './OnboardingModelLabel';
import { OnboardingAccountLabels } from './OnboardingAccountLabels';
import { OnboardingSessionLabels } from './OnboardingSessionLabels';

export function OnboardingPersonalPreview({
  model,
  providerId,
  personalProviderId,
  personalConnectionMethod,
  personalModel,
  preset,
}: Pick<
  OnboardingPreviewProps,
  'model' | 'providerId' | 'personalProviderId' | 'personalConnectionMethod' | 'personalModel' | 'preset'
>) {
  const individual = preset?.kind === 'individual';
  const providers = useProvidersQuery();
  const personal = providers.data?.find(item => item.provider === personalProviderId);
  const auth = useFactoryAuth();
  const scope = auth.data?.authEnabled === false ? undefined : 'user';
  const savedMethod = personal ? providerCredentialMethod(personal, scope) : undefined;
  const connected =
    savedMethod !== undefined && (!personalConnectionMethod || savedMethod === personalConnectionMethod);
  const name = personalProviderId ? providerDisplayName(personalProviderId) : undefined;
  const sharedModel = individual ? undefined : model;
  const method = (personalConnectionMethod ?? savedMethod) === 'oauth' ? 'Provider sign-in' : 'API key';
  const fallback = sharedModel ? 'No extra connection needed' : 'Connect your own account';
  const status = name
    ? connected
      ? 'Connected · only you'
      : 'Connect to use · only you'
    : sharedModel
      ? 'Ready to use'
      : 'No shared model set';
  return (
    <section aria-label="Personal access preview" className="relative h-full">
      <div className="absolute inset-x-8 top-3 flex items-start justify-between gap-4">
        <Txt variant="caption" tone="muted">
          {individual ? 'Individual accounts' : 'Shared work + your sessions'}
        </Txt>
        <Txt variant="meta" tone="muted">
          {name ? method : 'Personal access'}
        </Txt>
      </div>
      <OnboardingAccountLabels mode={individual ? 'individual' : 'hybrid'} />
      <OnboardingSessionLabels individual={individual} />
      <div className="onboarding-scene-detail absolute inset-x-7 top-[89%] grid grid-cols-2 gap-8">
        <div aria-label={individual ? 'Teammates model choices' : 'Factory work model'} className="min-w-0">
          <Txt variant="meta" tone="muted" className="mb-2">
            {individual ? 'Your teammates' : 'Factory work'}
          </Txt>
          {individual ? (
            <Txt variant="caption">They choose their model</Txt>
          ) : (
            <OnboardingModelLabel providerId={providerId} model={model} emptyLabel="Not configured" />
          )}
        </div>
        <div aria-label="Personal sessions provider" className="min-w-0">
          {preset && connected ? (
            <OnboardingModelLabel providerId={personalProviderId} model={personalModel} />
          ) : (
            <Txt variant="caption">{name ?? fallback}</Txt>
          )}
          <Txt variant="meta" tone="muted" className="mt-2">
            {status}
          </Txt>
        </div>
      </div>
    </section>
  );
}
