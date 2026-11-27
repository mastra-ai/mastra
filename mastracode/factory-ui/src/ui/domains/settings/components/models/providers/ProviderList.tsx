import { Button } from '@mastra/playground-ui/components/Button';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import { useCustomProvidersQuery } from '../../../../../../hooks/use-custom-providers';
import { useCancelProviderOAuth, useProvidersQuery } from '../../../../../../hooks/use-providers';
import { MastraGatewayCreditsNotice } from '../../../../workspaces/components/MastraGatewayCreditsNotice';
import { AddApiKeyDialog } from '../../AddApiKeyDialog';
import { ProviderOAuthDialog } from '../../ProviderOAuthDialog';
import {
  CREDENTIAL_STATUS,
  SIGN_IN_EXPIRED_LABEL,
  credentialAt,
  sharedSourceStatus,
  signInExpiredAt,
  useCredentialAccess,
} from '../../provider-credential';
import type { CredentialScope } from '../../provider-credential';
import { ListHeading } from '../ListHeading';
import { AddProviderDrawer } from './AddProviderDrawer';
import { ConnectedProviderRow } from './ConnectedProviderRow';
import type { ProviderConnection } from './ConnectedProviderRow';
import { CustomProviderDialog } from './CustomProviderDialog';
import { CustomProviderRow } from './CustomProviderRow';
import { ProviderRows, ProviderRowsSkeleton } from './ProviderRows';

const ORG_SCOPE_AUDIENCE = 'Shared with every Factory in your organization.';

const SIGN_IN_EXPIRED_STATUS: StatusPresentation = {
  label: SIGN_IN_EXPIRED_LABEL,
  tone: 'error',
  description: 'Could not renew this sign-in. Sign in again to keep using it.',
};

/** The custom endpoint dialog: adding one, or editing the one with this id. */
type CustomProviderDialogState = { mode: 'add' } | { mode: 'edit'; id: string };

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

function providerConnection(provider: ProviderInfo, scope: CredentialScope): ProviderConnection | undefined {
  const credential = credentialAt(provider, scope);
  if (credential) {
    const signInExpired = signInExpiredAt(provider, scope);
    const status = signInExpired ? SIGN_IN_EXPIRED_STATUS : CREDENTIAL_STATUS[credential];
    return { provider, status, credential, signInExpired };
  }
  const sharedStatus = sharedSourceStatus(provider.source);
  return sharedStatus && { provider, status: sharedStatus, credential: undefined, signInExpired: false };
}

function connectedProviders(providers: ProviderInfo[], scope: CredentialScope): ProviderConnection[] {
  return providers
    .flatMap(provider => providerConnection(provider, scope) ?? [])
    .toSorted((left, right) => left.provider.provider.localeCompare(right.provider.provider));
}

export function ProviderList({ credentialScope }: { credentialScope: CredentialScope }) {
  const providersQuery = useProvidersQuery();
  const customProvidersQuery = useCustomProvidersQuery();
  const { authEnabled, scope, requestScope, readOnly, actionsDisabled, memberReason } =
    useCredentialAccess(credentialScope);
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();
  const [customProviderDialog, setCustomProviderDialog] = useState<CustomProviderDialogState>();

  // Custom endpoints have their own rows and their own form, so the built-in
  // list and its key actions never see them.
  const providers = (providersQuery.data ?? []).filter(provider => !provider.custom);
  const connections = connectedProviders(providers, scope);
  const customProviders = (customProvidersQuery.data ?? []).filter(provider => provider.scope === scope);
  const editedProvider =
    customProviderDialog?.mode === 'edit'
      ? customProviders.find(provider => provider.id === customProviderDialog.id)
      : undefined;
  // An endpoint removed while its dialog is open closes the dialog.
  const customProviderDialogOpen = customProviderDialog?.mode === 'add' || editedProvider !== undefined;
  const error = providersQuery.error ?? customProvidersQuery.error;

  const openOAuth = (provider: string, session: OAuthStartResponse) => {
    setAddOpen(false);
    setActiveOAuth({ provider, session });
  };

  const openKeyDialog = (provider: ProviderInfo) => {
    setAddOpen(false);
    setKeyDialogProvider(provider);
  };

  const openCustomProviderDialog = () => {
    setAddOpen(false);
    setCustomProviderDialog({ mode: 'add' });
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
  };

  const audience = requestScope === 'org' && !readOnly ? ORG_SCOPE_AUDIENCE : undefined;
  if (providersQuery.isPending || customProvidersQuery.isPending)
    return <ProviderRowsSkeleton description={audience} />;

  return (
    <div className="flex flex-col gap-1">
      <ListHeading label="Providers" description={audience}>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Add provider"
          disabled={actionsDisabled}
          onClick={() => setAddOpen(true)}
        >
          <IconPlusMedium />
        </Button>
      </ListHeading>
      {connections.length === 0 && customProviders.length === 0 && (
        <Txt as="p" variant="caption" tone="muted">
          No providers yet.
        </Txt>
      )}
      <ProviderRows>
        {connections.map(connection => (
          <ConnectedProviderRow
            key={connection.provider.provider}
            connection={connection}
            requestScope={requestScope}
            disabled={actionsDisabled}
            onUpdateKey={() => setKeyDialogProvider(connection.provider)}
            onOAuthStarted={openOAuth}
          />
        ))}
        {customProviders.map(provider => (
          <CustomProviderRow
            key={provider.id}
            provider={provider}
            disabled={actionsDisabled}
            onEdit={() => setCustomProviderDialog({ mode: 'edit', id: provider.id })}
          />
        ))}
      </ProviderRows>
      {connections.some(connection => connection.provider.connectWithMastraAccount) && <MastraGatewayCreditsNotice />}
      {memberReason && (
        <Txt as="p" variant="caption" tone="muted">
          {memberReason}
        </Txt>
      )}
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {error.message}
        </Txt>
      )}

      <AddProviderDrawer
        open={addOpen}
        providers={providers}
        credentialScope={scope}
        requestScope={requestScope}
        onOAuthStarted={openOAuth}
        onAddKey={openKeyDialog}
        onAddCustomProvider={openCustomProviderDialog}
        onClose={() => setAddOpen(false)}
      />
      {keyDialogProvider && (
        <AddApiKeyDialog
          provider={keyDialogProvider}
          authEnabled={authEnabled}
          fixedScope={requestScope}
          onClose={() => setKeyDialogProvider(undefined)}
        />
      )}
      {customProviderDialogOpen && (
        <CustomProviderDialog
          provider={editedProvider}
          scope={scope}
          onClose={() => setCustomProviderDialog(undefined)}
        />
      )}
      {activeOAuth && (
        <ProviderOAuthDialog
          provider={activeOAuth.provider}
          session={activeOAuth.session}
          onClose={closeOAuth}
          onComplete={() => setActiveOAuth(undefined)}
        />
      )}
    </div>
  );
}
