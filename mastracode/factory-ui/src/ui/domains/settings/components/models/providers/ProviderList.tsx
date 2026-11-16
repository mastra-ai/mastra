import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
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
  const { authEnabled, scope, requestScope, readOnly, actionsDisabled, memberReason } =
    useCredentialAccess(credentialScope);
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  const providers = providersQuery.data ?? [];
  const connections = connectedProviders(providers, scope);

  const openOAuth = (provider: string, session: OAuthStartResponse) => {
    setAddOpen(false);
    setActiveOAuth({ provider, session });
  };

  const openKeyDialog = (provider: ProviderInfo) => {
    setAddOpen(false);
    setKeyDialogProvider(provider);
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
  };

  if (providersQuery.isPending) return <ProviderRowsSkeleton />;

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
      {providersQuery.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {providersQuery.error.message}
        </Txt>
      )}

      <AddProviderDrawer
        open={addOpen}
        providers={providers}
        credentialScope={scope}
        requestScope={requestScope}
        onOAuthStarted={openOAuth}
        onAddKey={openKeyDialog}
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
