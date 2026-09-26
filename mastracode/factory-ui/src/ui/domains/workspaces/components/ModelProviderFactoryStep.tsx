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
  const connection = useProviderConnection({ scope: 'org' });
  const error = connection.error ?? completionError;

  return (
    <section aria-label="Model provider setup" className="flex max-w-xl flex-col gap-5">
      <Txt as="p" variant="body" tone="muted" className="m-0">
        Connect an organization provider so everyone can use the default model for Factory runs.
      </Txt>

      {!connection.isPending &&
        connection.authEnabled &&
        !connection.orgKeyAdmin &&
        !connection.hasConfiguredProvider && (
          <Txt as="p" variant="caption" tone="muted" className="m-0">
            Ask an organization admin to connect a provider, then return here to continue.
          </Txt>
        )}

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
        <Txt as="p" variant="caption" className="text-destructive-fg m-0" role="alert">
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
