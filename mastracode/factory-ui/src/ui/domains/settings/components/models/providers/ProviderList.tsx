import { Button } from '@mastra/playground-ui/components/Button';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import { useCancelProviderOAuth, useOrgKeyAdminQuery, useProvidersQuery } from '../../../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../../../hooks/useFactoryAuth';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { AddApiKeyDialog } from '../../AddApiKeyDialog';
import { ProviderOAuthDialog } from '../../ProviderOAuthDialog';
import { CREDENTIAL_LABEL, credentialAt } from '../../provider-credential';
import type { CredentialScope, ProviderCredential } from '../../provider-credential';
import { AddProviderDialog } from './AddProviderDialog';
import { ConnectedProviderRow } from './ConnectedProviderRow';
import type { ProviderConnection } from './ConnectedProviderRow';

const ORG_SCOPE_MEMBER_REASON = 'Only organization admins can manage org-wide credentials.';

const CREDENTIAL_STATUS: Record<ProviderCredential, StatusPresentation> = {
  oauth: { label: CREDENTIAL_LABEL.oauth, tone: 'success', description: 'Signed in with a provider account' },
  api_key: { label: CREDENTIAL_LABEL.api_key, tone: 'success', description: 'An API key is saved' },
};

const SHARED_SOURCE_STATUS: Partial<Record<ProviderInfo['source'], StatusPresentation>> = {
  env: { label: 'From env', tone: 'neutral', description: 'Read from the server environment' },
  deployment: { label: 'From deployment', tone: 'neutral', description: 'Provided by the deployment' },
};

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

function storedCredentialScope(requested: CredentialScope, authEnabled: boolean): CredentialScope {
  const hasSeparateOrgStore = authEnabled;
  return requested === 'org' && hasSeparateOrgStore ? 'org' : 'user';
}

function providerConnection(
  provider: ProviderInfo,
  scope: CredentialScope,
  showSharedSources: boolean,
): ProviderConnection | undefined {
  const credential = credentialAt(provider, scope);
  if (credential) return { provider, status: CREDENTIAL_STATUS[credential], credential };
  if (!showSharedSources) return undefined;
  const sharedStatus = SHARED_SOURCE_STATUS[provider.source];
  return sharedStatus && { provider, status: sharedStatus, credential: undefined };
}

function connectedProviders(
  providers: ProviderInfo[],
  scope: CredentialScope,
  showSharedSources: boolean,
): ProviderConnection[] {
  return providers
    .flatMap(provider => providerConnection(provider, scope, showSharedSources) ?? [])
    .toSorted((left, right) => left.provider.provider.localeCompare(right.provider.provider));
}

export function ProviderList({ credentialScope }: { credentialScope: CredentialScope }) {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  const authEnabled = authQuery.data?.authEnabled === true;
  const scope = storedCredentialScope(credentialScope, authEnabled);
  const requestScope = authEnabled ? scope : undefined;
  const readOnly = scope === 'org' && orgKeyAdminQuery.data === false;
  const actionsDisabled = authQuery.isPending || readOnly;
  const providers = providersQuery.data ?? [];
  const connections = connectedProviders(providers, scope, credentialScope === 'org');

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

  if (providersQuery.isPending) {
    return <SkeletonRows label="Loading providers" rows={2} rowClassName="h-9 w-full" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {connections.map(connection => (
          <ConnectedProviderRow
            key={connection.provider.provider}
            connection={connection}
            requestScope={requestScope}
            disabled={actionsDisabled}
            onUpdateKey={() => setKeyDialogProvider(connection.provider)}
          />
        ))}
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-full justify-start rounded-none pl-3"
            disabled={actionsDisabled}
            onClick={() => setAddOpen(true)}
          >
            <Plus aria-hidden="true" />
            Add provider
          </Button>
        </li>
      </ul>
      {readOnly && (
        <Txt as="p" variant="caption" tone="muted">
          {ORG_SCOPE_MEMBER_REASON}
        </Txt>
      )}
      {providersQuery.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {providersQuery.error.message}
        </Txt>
      )}

      {addOpen && (
        <AddProviderDialog
          providers={providers}
          credentialScope={scope}
          requestScope={requestScope}
          onOAuthStarted={openOAuth}
          onAddKey={openKeyDialog}
          onClose={() => setAddOpen(false)}
        />
      )}
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
