import { Button } from '@mastra/playground-ui/components/Button';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../../api/types';
import { useCancelProviderOAuth, useOrgKeyAdminQuery, useProvidersQuery } from '../../../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../../../hooks/useFactoryAuth';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { AddApiKeyDialog } from '../../AddApiKeyDialog';
import { ProviderOAuthDialog } from '../../ProviderOAuthDialog';
import {
  CREDENTIAL_LABEL,
  SHARED_SOURCE,
  SIGN_IN_EXPIRED_LABEL,
  credentialAt,
  signInExpiredAt,
} from '../../provider-credential';
import type { CredentialScope, ProviderCredential } from '../../provider-credential';
import { AddProviderDrawer } from './AddProviderDrawer';
import { ConnectedProviderRow } from './ConnectedProviderRow';
import type { ProviderConnection } from './ConnectedProviderRow';

const ORG_SCOPE_MEMBER_REASON = 'Only organization admins can manage org-wide credentials.';
const ORG_SCOPE_AUDIENCE = 'Shared with every Factory in your organization.';

const CREDENTIAL_STATUS: Record<ProviderCredential, StatusPresentation> = {
  oauth: { label: CREDENTIAL_LABEL.oauth, tone: 'success', description: 'Signed in with a provider account' },
  api_key: { label: CREDENTIAL_LABEL.api_key, tone: 'success', description: 'An API key is saved' },
};

const SIGN_IN_EXPIRED_STATUS: StatusPresentation = {
  label: SIGN_IN_EXPIRED_LABEL,
  tone: 'error',
  description: 'Could not renew this sign-in. Sign in again to keep using it.',
};

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

function storedCredentialScope(requested: CredentialScope, authEnabled: boolean): CredentialScope {
  const hasSeparateOrgStore = authEnabled;
  return requested === 'org' && hasSeparateOrgStore ? 'org' : 'user';
}

function sharedSourceStatus(source: ProviderInfo['source']): StatusPresentation | undefined {
  const shared = SHARED_SOURCE[source];
  return shared && { label: shared.label, tone: 'neutral', description: shared.description };
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

  if (providersQuery.isPending) {
    return (
      <div className="border-border overflow-hidden rounded-lg border">
        <SkeletonRows label="Loading providers" rows={3} className="divide-border gap-0 divide-y">
          <div aria-hidden className="flex min-h-10 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
            <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-28 max-w-full motion-reduce:before:animate-none" />
            </div>
            <Skeleton className="h-3 w-20 motion-reduce:before:animate-none" />
            <Skeleton className="size-control-sm shrink-0 rounded-full motion-reduce:before:animate-none" />
          </div>
        </SkeletonRows>
      </div>
    );
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
            onOAuthStarted={openOAuth}
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
