import type { OnboardingModelChoice } from '../services/onboardingFlow';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useProviderConnection } from '../hooks/useProviderConnection';
import type { PreviewProvider } from '../hooks/useProviderConnection';
import { FactoryDefaultModelForm } from './FactoryDefaultModelForm';
import { ModelProviderPicker } from './ModelProviderPicker';
import { ProviderConnectionDialogs } from './ProviderConnectionDialogs';

export interface PersonalProviderFactoryStepProps {
  onContinue: (choice: OnboardingModelChoice) => void;
  initialChoice?: OnboardingModelChoice;
  onPreviewModel?: (modelId: string | undefined) => void;
  onPreviewProvider?: PreviewProvider;
}

export function PersonalProviderFactoryStep({
  onContinue,
  onPreviewProvider,
  initialChoice,
  onPreviewModel,
}: PersonalProviderFactoryStepProps) {
  const connection = useProviderConnection({ scope: 'user', initialSelection: initialChoice });
  const connectedProvider = connection.connected ? connection.provider : undefined;
  return (
    <section aria-label="Personal provider setup" className="flex max-w-xl flex-col gap-6">
      {connectedProvider ? (
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
            if (connection.method) {
              onContinue({ providerId: connectedProvider.provider, method: connection.method, modelId });
            }
          }}
        />
      ) : (
        <ModelProviderPicker connection={connection} onPreviewProvider={onPreviewProvider} />
      )}
      {connection.error && (
        <Txt role="alert" variant="caption" className="text-destructive-foreground">
          {connection.error}
        </Txt>
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
