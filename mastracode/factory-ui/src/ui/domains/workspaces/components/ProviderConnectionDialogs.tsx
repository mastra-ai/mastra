import type { ProviderInfo } from '../../../../api/types';
import { AddApiKeyDialog } from '../../settings/components/AddApiKeyDialog';
import { ProviderOAuthDialog } from '../../settings/components/ProviderOAuthDialog';
import type { ActiveProviderOAuth } from '../hooks/useProviderConnection';

export interface ProviderConnectionDialogsProps {
  keyProvider?: ProviderInfo;
  oauth?: ActiveProviderOAuth;
  authEnabled: boolean;
  onCloseKeyDialog: () => void;
  onCloseOAuth: () => void;
  onCompleteOAuth: () => void;
}

/** The two ways a provider gets connected during Factory setup. */
export function ProviderConnectionDialogs({
  keyProvider,
  oauth,
  authEnabled,
  onCloseKeyDialog,
  onCloseOAuth,
  onCompleteOAuth,
}: ProviderConnectionDialogsProps) {
  return (
    <>
      {keyProvider && (
        <AddApiKeyDialog
          provider={keyProvider}
          authEnabled={authEnabled}
          // The default model is shared, so an org key is what lets teammates run it.
          defaultScope="org"
          onClose={onCloseKeyDialog}
        />
      )}
      {oauth && (
        <ProviderOAuthDialog
          provider={oauth.provider}
          session={oauth.session}
          onClose={onCloseOAuth}
          onComplete={onCompleteOAuth}
        />
      )}
    </>
  );
}
