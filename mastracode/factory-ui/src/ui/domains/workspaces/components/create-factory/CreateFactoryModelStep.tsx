import { useProviderConnection } from '../../hooks/useProviderConnection';
import { ProviderConnectionDialogs } from '../ProviderConnectionDialogs';
import { CreateFactoryModelRows } from './CreateFactoryModelRows';
import { CreateFactoryProviderRows } from './CreateFactoryProviderRows';

export interface CreateFactoryModelStepProps {
  query: string;
  savingModelId?: string;
  error?: string;
  onPick: (providerId: string, modelId: string) => void;
}

/** Connect a provider, then pick the model that creates the Factory. */
export function CreateFactoryModelStep({ query, savingModelId, error, onPick }: CreateFactoryModelStepProps) {
  const connection = useProviderConnection();
  const connectedProvider = connection.connected ? connection.provider : undefined;

  return (
    <>
      {connectedProvider ? (
        <CreateFactoryModelRows
          provider={connectedProvider}
          query={query}
          savingModelId={savingModelId}
          error={error}
          onPick={modelId => onPick(connectedProvider.provider, modelId)}
          onChangeProvider={connection.clear}
        />
      ) : (
        <CreateFactoryProviderRows connection={connection} query={query} error={connection.error ?? error} />
      )}

      <ProviderConnectionDialogs
        keyProvider={connection.keyDialogProvider}
        oauth={connection.activeOAuth}
        authEnabled={connection.authEnabled}
        onCloseKeyDialog={connection.closeKeyDialog}
        onCloseOAuth={connection.closeOAuth}
        onCompleteOAuth={connection.completeOAuth}
      />
    </>
  );
}
