import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Status } from '@mastra/playground-ui/components/StatusIndicators';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import {
  useRemoveProviderKey,
  useSignOutProviderOAuth,
  useStartProviderOAuth,
} from '../../../../../../hooks/use-providers';
import { useProviderAccountsQuery } from '../../../../../../hooks/use-provider-accounts';
import type { AccountScope } from '../../../../../../hooks/use-provider-accounts';
import { ProviderBrandIcon } from '../../../../workspaces/components/ProviderBrandIcon';
import { signInRequest } from '../../provider-credential';
import type { CredentialScope, ProviderCredential } from '../../provider-credential';
import { ProviderAccountPool } from './ProviderAccountPool';

export interface ProviderConnection {
  provider: ProviderInfo;
  status: StatusPresentation;
  credential: ProviderCredential | undefined;
  signInExpired: boolean;
}

const SIGNING_OUT_STATUS: StatusPresentation = {
  label: 'Signing out…',
  tone: 'progress',
  description: 'Ending the provider sign-in',
};
const REMOVING_STATUS: StatusPresentation = {
  label: 'Removing…',
  tone: 'progress',
  description: 'Deleting the saved API key',
};
const STARTING_SIGN_IN_STATUS: StatusPresentation = {
  label: 'Starting sign-in…',
  tone: 'progress',
  description: 'Opening the provider sign-in',
};

function pendingStatus(pending: {
  signingOut: boolean;
  removing: boolean;
  startingSignIn: boolean;
}): StatusPresentation | undefined {
  if (pending.signingOut) return SIGNING_OUT_STATUS;
  if (pending.removing) return REMOVING_STATUS;
  if (pending.startingSignIn) return STARTING_SIGN_IN_STATUS;
  return undefined;
}

export function ConnectedProviderRow({
  connection,
  requestScope,
  accountScope,
  manageable,
  disabled,
  onUpdateKey,
  onOAuthStarted,
}: {
  connection: ProviderConnection;
  requestScope: CredentialScope | undefined;
  /** Scope the provider's account pool is read and managed at. */
  accountScope: AccountScope;
  /** False for members viewing org credentials: the pool shows without its controls. */
  manageable: boolean;
  disabled: boolean;
  onUpdateKey: () => void;
  onOAuthStarted: (provider: string, session: OAuthStartResponse) => void;
}) {
  const { provider, status, credential, signInExpired } = connection;
  const displayName = providerDisplayName(provider.provider);
  const signOutMutation = useSignOutProviderOAuth();
  const removeKeyMutation = useRemoveProviderKey();
  const startOAuthMutation = useStartProviderOAuth();
  const accountsQuery = useProviderAccountsQuery(provider.provider, accountScope, credential !== undefined);
  const accounts = accountsQuery.data ?? [];
  const active = accounts.length > 1 ? accounts.find(account => account.active) : undefined;
  // With several pooled accounts, signing out drops only the active one.
  const activeLabel = active?.label;
  // Removing a key only ever drops an API key, never a sign-in account.
  const keyLabel = active?.type === 'api-key' ? active.label : `the ${displayName} API key`;
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const pending = pendingStatus({
    signingOut: signOutMutation.isPending,
    removing: removeKeyMutation.isPending,
    startingSignIn: startOAuthMutation.isPending,
  });

  const signOut = () => {
    signOutMutation.mutate(
      { provider: provider.provider, scope: requestScope },
      { onError: error => toast.error(error.message || 'Failed to sign out') },
    );
  };

  const signInAgain = () => {
    startOAuthMutation.mutate(signInRequest(provider, requestScope), {
      onSuccess: session => onOAuthStarted(provider.provider, session),
      onError: error => toast.error(error.message || 'Failed to start sign-in'),
    });
  };

  const removeKey = () => {
    setConfirmingRemoval(false);
    removeKeyMutation.mutate(
      { provider: provider.provider, scope: requestScope },
      { onError: error => toast.error(error.message || 'Failed to remove API key') },
    );
  };

  return (
    <li className="flex flex-col py-1.5 pr-1.5 pl-3">
      <div className="flex min-h-7 items-center gap-2.5">
        <ProviderBrandIcon provider={provider.provider} fallback={<Box className="text-muted-foreground size-4" />} />
        <Txt as="span" variant="caption" className="min-w-0 flex-1 truncate">
          {displayName}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="shrink-0">
          <Status presentation={pending ?? status} />
        </Txt>
        {credential ? (
          <CredentialMenu
            displayName={displayName}
            credential={credential}
            disabled={disabled || pending !== undefined}
            onSignInAgain={signInExpired && provider.oauth?.supported === true ? signInAgain : undefined}
            onSignOut={signOut}
            onUpdateKey={onUpdateKey}
            onRemoveKey={() => setConfirmingRemoval(true)}
            onAddAccount={provider.oauth?.supported === true ? signInAgain : onUpdateKey}
            activeLabel={activeLabel}
          />
        ) : (
          <span aria-hidden="true" className="size-control-sm shrink-0" />
        )}
      </div>
      <AlertDialog open={confirmingRemoval} onOpenChange={setConfirmingRemoval}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Remove {keyLabel}?</AlertDialog.Title>
            <AlertDialog.Description>
              This removes only this API key. {displayName} sign-ins stay connected.
              {accounts.length > 1 && ' The next account in the order becomes active.'}
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button variant="destructive" size="md" onClick={removeKey}>
              Remove key
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
      {credential && (
        <ProviderAccountPool
          provider={provider.provider}
          displayName={displayName}
          scope={accountScope}
          manageable={manageable}
          disabled={disabled}
        />
      )}
    </li>
  );
}

function CredentialMenu({
  displayName,
  credential,
  disabled,
  onSignInAgain,
  onSignOut,
  onUpdateKey,
  onRemoveKey,
  onAddAccount,
  activeLabel,
}: {
  displayName: string;
  credential: ProviderCredential;
  disabled: boolean;
  onSignInAgain: (() => void) | undefined;
  onSignOut: () => void;
  onUpdateKey: () => void;
  onRemoveKey: () => void;
  onAddAccount: () => void;
  /** Set when the pool holds several accounts, so the menu names the one sign-out drops. */
  activeLabel: string | undefined;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`${displayName} actions`} disabled={disabled}>
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item onClick={onAddAccount}>Add account</DropdownMenu.Item>
        {credential === 'oauth' ? (
          <>
            {onSignInAgain && <DropdownMenu.Item onClick={onSignInAgain}>Sign in again</DropdownMenu.Item>}
            <DropdownMenu.Item onClick={onSignOut}>
              {activeLabel ? `Sign out of ${activeLabel}` : 'Sign out'}
            </DropdownMenu.Item>
          </>
        ) : (
          <>
            <DropdownMenu.Item onClick={onUpdateKey}>Update key</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onRemoveKey}>Remove API key</DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
