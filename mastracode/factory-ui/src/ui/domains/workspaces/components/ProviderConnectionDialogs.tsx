import type { ProviderInfo } from '../../../../api/types';
import { AddApiKeyDialog } from '../../settings/components/AddApiKeyDialog';
import { ProviderOAuthDialog } from '../../settings/components/ProviderOAuthDialog';
import type { ActiveProviderOAuth, ProviderCredentialScope } from '../hooks/useProviderConnection';

const SCOPED_SIGN_IN_ACCESS: Record<ProviderCredentialScope, string> = {
  org: 'Everyone in your organization can use this provider connection.',
  user: 'This provider connection is only for you. Shared organization access stays unchanged.',
};

export interface ProviderConnectionDialogsProps {
  keyProvider?: ProviderInfo;
  oauth?: ActiveProviderOAuth;
  authEnabled: boolean;
  fixedScope?: ProviderCredentialScope;
  onCloseKeyDialog: () => void;
  onCloseOAuth: () => void;
  onCompleteOAuth: () => void;
}

/** The two ways a provider gets connected during Factory setup. */
export function ProviderConnectionDialogs({
  keyProvider,
  oauth,
  authEnabled,
  fixedScope,
  onCloseKeyDialog,
  onCloseOAuth,
  onCompleteOAuth,
}: ProviderConnectionDialogsProps) {
  const replacementNotice = oauth?.replaces
    ? ' Completing sign-in replaces the existing connection for this provider at this scope.'
    : '';
  return (
    <>
      {keyProvider && (
        <AddApiKeyDialog
          provider={keyProvider}
          authEnabled={authEnabled}
          // The default model is shared, so an org key is what lets teammates run it.
          defaultScope="org"
          fixedScope={authEnabled ? fixedScope : undefined}
          onClose={onCloseKeyDialog}
        />
      )}
      {oauth && (
        <ProviderOAuthDialog
          provider={oauth.provider}
          session={oauth.session}
          scopeNotice={authEnabled && fixedScope ? SCOPED_SIGN_IN_ACCESS[fixedScope] + replacementNotice : undefined}
          onClose={onCloseOAuth}
          onComplete={onCompleteOAuth}
        />
      )}
    </>
  );
}
