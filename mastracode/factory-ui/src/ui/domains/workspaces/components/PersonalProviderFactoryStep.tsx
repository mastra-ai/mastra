import type { OnboardingConnectionChoice } from '../services/onboardingFlow';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProviderConnection } from '../hooks/useProviderConnection';
import type { PreviewProvider } from '../hooks/useProviderConnection';
import { providerDisplayName } from '../../settings/components/provider-display-name';
import { FactoryDefaultModelForm } from './FactoryDefaultModelForm';
import { ModelProviderPicker } from './ModelProviderPicker';
import { OnboardingConnectionRow } from './onboarding/OnboardingConnectionRow';
import { ProviderBrandIcon } from './ProviderBrandIcon';
import { ProviderConnectionDialogs } from './ProviderConnectionDialogs';

export interface PersonalProviderFactoryStepProps {
  onContinue: (choice?: OnboardingConnectionChoice) => void;
  initialChoice?: OnboardingConnectionChoice;
  modelChoice?: 'required' | 'optional';
  onPreviewModel?: (modelId: string | undefined) => void;
  onPreviewProvider?: PreviewProvider;
}

export function PersonalProviderFactoryStep({
  onContinue,
  onPreviewProvider,
  initialChoice,
  modelChoice,
  onPreviewModel,
}: PersonalProviderFactoryStepProps) {
  const connection = useProviderConnection({ scope: 'user', initialSelection: initialChoice });
  const connectedProvider = connection.connected ? connection.provider : undefined;
  const connectedChoice =
    connectedProvider && connection.method
      ? { providerId: connectedProvider.provider, method: connection.method }
      : undefined;
  const canSkipModel = !modelChoice || (modelChoice === 'optional' && !connection.connected);
  return (
    <section aria-label="Personal provider setup" className="flex max-w-xl flex-col gap-6">
      {connectedProvider && modelChoice && (
        <FactoryDefaultModelForm
          key={connectedProvider.provider}
          scope="user"
          provider={connectedProvider}
          initialModelId={initialChoice?.providerId === connectedProvider.provider ? initialChoice.modelId : undefined}
          onPreviewModel={onPreviewModel}
          submitLabel="Review setup"
          onChangeProvider={() => {
            connection.clear();
            onPreviewProvider?.(undefined);
            onPreviewModel?.(undefined);
          }}
          onContinue={modelId => {
            if (connectedChoice) onContinue({ ...connectedChoice, modelId });
          }}
        />
      )}
      {connectedProvider && !modelChoice && (
        <OnboardingConnectionRow
          icon={<ProviderBrandIcon provider={connectedProvider.provider} />}
          name={providerDisplayName(connectedProvider.provider)}
          description={connection.method === 'oauth' ? 'Provider sign-in · only you.' : 'API key · only you.'}
          connected
          action={
            <Button
              variant="ghost"
              onClick={() => {
                connection.clear();
                onPreviewProvider?.(undefined);
              }}
            >
              Add another
            </Button>
          }
        />
      )}
      {!connectedProvider && <ModelProviderPicker connection={connection} onPreviewProvider={onPreviewProvider} />}
      {connection.error && (
        <Txt role="alert" variant="caption" className="text-destructive-foreground">
          {connection.error}
        </Txt>
      )}
      {canSkipModel && (
        <div>
          <Button variant={modelChoice ? 'ghost' : 'primary'} size="lg" onClick={() => onContinue(connectedChoice)}>
            {modelChoice ? 'Skip for now' : 'Review setup'}
          </Button>
        </div>
      )}
      <ProviderConnectionDialogs
        keyProvider={connection.keyDialogProvider}
        oauth={connection.activeOAuth}
        authEnabled={connection.authEnabled}
        fixedScope="user"
        onCloseKeyDialog={connection.closeKeyDialog}
        onCloseOAuth={connection.closeOAuth}
        onCompleteOAuth={connection.completeOAuth}
      />
    </section>
  );
}
