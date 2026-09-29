import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

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
  const [browsingProviders, setBrowsingProviders] = useState(false);
  const error = connection.error ?? completionError;

  // When the organization already has a provider, go straight to the model
  // choice instead of making the user pick that provider from the list first.
  const configuredProviders = [...connection.signInProviders, ...connection.keyProviders].filter(
    connection.isConfigured,
  );
  const provider = connection.provider ?? (browsingProviders ? undefined : configuredProviders[0]);
  const connected = provider ? connection.isConfigured(provider) : false;
  // Members can only pick an already connected provider, so the list only
  // offers them something when more than one is connected.
  const canChangeProvider = connection.orgKeyAdmin || configuredProviders.length > 1;

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

      {!connection.isPending && connected && provider ? (
        <FactoryDefaultModelForm
          key={provider.provider}
          factoryId={factoryId}
          provider={provider}
          onSaved={onComplete}
          onChangeProvider={
            canChangeProvider
              ? () => {
                  setBrowsingProviders(true);
                  connection.clear();
                }
              : undefined
          }
        />
      ) : (
        <ModelProviderPicker connection={connection} />
      )}

      {error && (
        <Txt as="p" variant="caption" className="text-destructive-indicator m-0" role="alert">
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
