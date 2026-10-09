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
  completionError?: string;
  onComplete: (choice?: OnboardingModelChoice) => void;
  onPreviewProvider?: PreviewProvider;
  onPreviewModel?: (model: string | undefined) => void;
}

export function ModelProviderFactoryStep({
  initialChoice,
  completionError,
  onComplete,
  onPreviewModel,
  onPreviewProvider,
}: ModelProviderFactoryStepProps) {
  const connection = useProviderConnection({ scope: 'org', initialSelection: initialChoice });
  const error = connection.error ?? completionError;
  const needsAdmin =
    !connection.isPending &&
    !connection.catalogError &&
    connection.authEnabled &&
    !connection.orgKeyAdmin &&
    !connection.hasConfiguredProvider;

  return (
    <section aria-label="Model provider setup" className="flex max-w-xl flex-col gap-5">
      {needsAdmin ? (
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
      ) : connection.connected && connection.provider ? (
        <FactoryDefaultModelForm
          key={connection.provider.provider}
          initialModelId={
            initialChoice?.providerId === connection.provider.provider ? initialChoice.modelId : undefined
          }
          provider={connection.provider}
          onContinue={modelId => {
            if (connection.provider && connection.method)
              onComplete({ providerId: connection.provider.provider, modelId, method: connection.method });
          }}
          onPreviewModel={onPreviewModel}
          submitLabel="Continue"
          onChangeProvider={() => {
            connection.clear();
            onPreviewModel?.(undefined);
            onPreviewProvider?.(undefined);
          }}
        />
      ) : (
        <ModelProviderPicker connection={connection} onPreviewProvider={onPreviewProvider} />
      )}

      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground m-0" role="alert">
          {error}
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
