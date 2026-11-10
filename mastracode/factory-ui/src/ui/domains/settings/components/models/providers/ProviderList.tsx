import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { CustomProviderInfo, OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
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
  const [customProviderDraft, setCustomProviderDraft] = useState<CustomProviderInfo | 'new'>();

  // Custom endpoints have their own rows and their own form, so the built-in
  // list and its key actions never see them.
  const providers = (providersQuery.data ?? []).filter(provider => !provider.custom);
  const connections = connectedProviders(providers, scope);
  const customProviders = (customProvidersQuery.data ?? []).filter(provider => provider.scope === scope);
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
    setCustomProviderDraft('new');
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
  };

  if (providersQuery.isPending || customProvidersQuery.isPending) return <ProviderRowsSkeleton />;

  return (
    <div className="flex flex-col gap-2">
      <ProviderRows addDisabled={actionsDisabled} onAdd={() => setAddOpen(true)}>
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
            onEdit={() => setCustomProviderDraft(provider)}
          />
        ))}
      </ProviderRows>
      {connections.some(connection => connection.provider.connectWithMastraAccount) && <MastraGatewayCreditsNotice />}
      {memberReason && (
        <Txt as="p" variant="caption" tone="muted">
          {memberReason}
        </Txt>
      )}
      {requestScope === 'org' && !readOnly && (
        <Txt as="p" variant="caption" tone="muted">
          {ORG_SCOPE_AUDIENCE}
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
      {customProviderDraft && (
        <CustomProviderDialog
          provider={customProviderDraft === 'new' ? undefined : customProviderDraft}
          scope={scope}
          onClose={() => setCustomProviderDraft(undefined)}
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
