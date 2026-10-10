import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useProviderConnection } from '../hooks/useProviderConnection';
import type { PreviewProvider } from '../hooks/useProviderConnection';
import type { OnboardingModelChoice } from '../services/onboardingFlow';
import { FactoryDefaultModelForm } from './FactoryDefaultModelForm';
import { ModelProviderPicker } from './ModelProviderPicker';
import { ProviderConnectionDialogs } from './ProviderConnectionDialogs';

export interface ModelProviderFactoryStepProps {
  initialChoice?: OnboardingModelChoice;
  onComplete: (choice?: OnboardingModelChoice) => void;
  onPreviewProvider?: PreviewProvider;
  onPreviewModel?: (model: string | undefined) => void;
}

export function ModelProviderFactoryStep({
  initialChoice,
  onComplete,
  onPreviewModel,
  onPreviewProvider,
}: ModelProviderFactoryStepProps) {
  const connection = useProviderConnection({ scope: 'org', initialSelection: initialChoice });
  const needsAdmin =
    !connection.isPending &&
    !connection.catalogError &&
    connection.authEnabled &&
    !connection.orgKeyAdmin &&
    !connection.hasConfiguredProvider;
  const connectedProvider = connection.connected ? connection.provider : undefined;

  return (
    <section aria-label="Model provider setup" className="flex max-w-xl flex-col gap-5">
      {needsAdmin && (
        <div className="flex flex-col gap-3">
          <Txt variant="caption" tone="muted">
            An admin connects organization access. You can set up your personal access next.
          </Txt>
          <div>
            <Button variant="primary" onClick={() => onComplete()}>
              Continue with personal access
            </Button>
          </div>
        </div>
      )}
      {!needsAdmin && connectedProvider && (
        <FactoryDefaultModelForm
          key={connectedProvider.provider}
          initialModelId={initialChoice?.providerId === connectedProvider.provider ? initialChoice.modelId : undefined}
          provider={connectedProvider}
          onContinue={modelId => {
            if (connection.method)
              onComplete({ providerId: connectedProvider.provider, modelId, method: connection.method });
          }}
          onPreviewModel={onPreviewModel}
          submitLabel="Continue"
          onChangeProvider={() => {
            connection.clear();
            onPreviewModel?.(undefined);
            onPreviewProvider?.(undefined);
          }}
        />
      )}
      {!needsAdmin && !connectedProvider && (
        <ModelProviderPicker connection={connection} onPreviewProvider={onPreviewProvider} />
      )}

      {connection.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground m-0" role="alert">
          {connection.error}
        </Txt>
      )}

      <ProviderConnectionDialogs
        keyProvider={connection.keyDialogProvider}
        oauth={connection.activeOAuth}
        authEnabled={connection.authEnabled}
        fixedScope="org"
        onCloseKeyDialog={connection.closeKeyDialog}
        onCloseOAuth={connection.closeOAuth}
        onCompleteOAuth={connection.completeOAuth}
      />
    </section>
  );
}
