import { Txt } from '@mastra/playground-ui/components/Txt';

import { useProviderConnection } from '../hooks/useProviderConnection';
import { FactoryDefaultModelForm } from './FactoryDefaultModelForm';
import { ModelProviderPicker } from './ModelProviderPicker';
import { ProviderConnectionDialogs } from './ProviderConnectionDialogs';

export interface ModelProviderFactoryStepProps {
  factoryId: string;
  completionError?: string;
  onComplete: () => void;
}

export function ModelProviderFactoryStep({ factoryId, completionError, onComplete }: ModelProviderFactoryStepProps) {
  const connection = useProviderConnection();
  const error = connection.error ?? completionError;

  return (
    <section aria-label="Model provider setup" className="flex max-w-xl flex-col gap-5">
      {connection.connected && connection.provider ? (
        <FactoryDefaultModelForm
          factoryId={factoryId}
          provider={connection.provider}
          onSaved={onComplete}
          onChangeProvider={connection.clear}
        />
      ) : (
        <ModelProviderPicker connection={connection} />
      )}

      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg m-0" role="alert">
          {error}
        </Txt>
      )}

      <ProviderConnectionDialogs
        keyProvider={connection.keyDialogProvider}
        oauth={connection.activeOAuth}
        authEnabled={connection.authEnabled}
        onCloseKeyDialog={connection.closeKeyDialog}
        onCloseOAuth={connection.closeOAuth}
        onCompleteOAuth={connection.completeOAuth}
      />
    </section>
  );
}
