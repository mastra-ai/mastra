import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Status } from '@mastra/playground-ui/components/StatusIndicators';
import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Box, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../api/types';
import {
  useCancelProviderOAuth,
  useOrgKeyAdminQuery,
  useProvidersQuery,
  useRemoveProviderKey,
  useSignOutProviderOAuth,
  useStartProviderOAuth,
} from '../../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { AddApiKeyDialog } from '../AddApiKeyDialog';
import { ProviderOAuthDialog } from '../ProviderOAuthDialog';
import { CREDENTIAL_LABEL, credentialAt } from '../provider-credential';
import type { CredentialScope, ProviderCredential } from '../provider-credential';
import { AddProviderDialog } from './AddProviderDialog';

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

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// Without auth there is one credential store, so both scopes write to it.
export function ProviderList({ credentialScope }: { credentialScope: CredentialScope }) {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const signOutMutation = useSignOutProviderOAuth();
  const removeKeyMutation = useRemoveProviderKey();
  const [addOpen, setAddOpen] = useState(false);
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  const authEnabled = authQuery.data?.authEnabled === true;
  const scope: CredentialScope = credentialScope === 'org' && authEnabled ? 'org' : 'user';
  const readOnly = scope === 'org' && orgKeyAdminQuery.data === false;
  const actionsDisabled = authQuery.isPending || readOnly;
  const scopeArg = authEnabled ? { scope } : {};
  const providers = providersQuery.data ?? [];

  const statusOf = (provider: ProviderInfo): StatusPresentation | undefined => {
    const own = credentialAt(provider, scope);
    if (own) return CREDENTIAL_STATUS[own];
    return credentialScope === 'org' ? SHARED_SOURCE_STATUS[provider.source] : undefined;
  };
  const connected = providers
    .flatMap(provider => {
      const status = statusOf(provider);
      return status ? [{ provider, status }] : [];
    })
    .toSorted((left, right) => left.provider.provider.localeCompare(right.provider.provider));
  const startingProvider = startOAuthMutation.isPending ? startOAuthMutation.variables.provider : undefined;

  const startOAuth = (provider: ProviderInfo) => {
    const modes = provider.oauth?.modes ?? [];
    startOAuthMutation.mutate(
      { provider: provider.provider, mode: modes.length === 1 ? modes[0] : undefined, ...scopeArg },
      {
        onSuccess: session => {
          setAddOpen(false);
          setActiveOAuth({ provider: provider.provider, session });
        },
      },
    );
  };

  const closeAddProvider = () => {
    setAddOpen(false);
    startOAuthMutation.reset();
  };

  const openKeyDialog = (provider: ProviderInfo) => {
    closeAddProvider();
    setKeyDialogProvider(provider);
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
  };

  const signOut = (provider: ProviderInfo) => {
    signOutMutation.mutate(
      { provider: provider.provider, ...scopeArg },
      { onError: error => toast.error(mutationErrorMessage(error, 'Failed to sign out')) },
    );
  };

  const removeKey = (provider: ProviderInfo) => {
    removeKeyMutation.mutate(
      { provider: provider.provider, ...scopeArg },
      { onError: error => toast.error(mutationErrorMessage(error, 'Failed to remove API key')) },
    );
  };

  if (providersQuery.isPending) {
    return <SkeletonRows label="Loading providers" rows={2} rowClassName="h-9 w-full" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {connected.map(({ provider, status }) => {
          const displayName = providerDisplayName(provider.provider);
          const own = credentialAt(provider, scope);
          return (
            <li key={provider.provider} className="flex min-h-10 items-center gap-2.5 py-1.5 pr-1.5 pl-3">
              <ProviderBrandIcon
                provider={provider.provider}
                fallback={<Box className="text-muted-foreground size-4" />}
              />
              <Txt as="span" variant="caption" className="min-w-0 flex-1 truncate">
                {displayName}
              </Txt>
              <Txt as="span" variant="meta" tone="muted" className="shrink-0">
                <Status presentation={status} />
              </Txt>
              {own ? (
                <CredentialMenu
                  displayName={displayName}
                  credential={own}
                  disabled={actionsDisabled}
                  onSignOut={() => signOut(provider)}
                  onUpdateKey={() => setKeyDialogProvider(provider)}
                  onRemoveKey={() => removeKey(provider)}
                />
              ) : (
                <span aria-hidden="true" className="size-control-sm shrink-0" />
              )}
            </li>
          );
        })}
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
          startingProvider={startingProvider}
          error={startOAuthMutation.error?.message}
          onSignIn={startOAuth}
          onAddKey={openKeyDialog}
          onClose={closeAddProvider}
        />
      )}
      {keyDialogProvider && (
        <AddApiKeyDialog
          provider={keyDialogProvider}
          authEnabled={authEnabled}
          fixedScope={authEnabled ? scope : undefined}
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

function CredentialMenu({
  displayName,
  credential,
  disabled,
  onSignOut,
  onUpdateKey,
  onRemoveKey,
}: {
  displayName: string;
  credential: ProviderCredential;
  disabled: boolean;
  onSignOut: () => void;
  onUpdateKey: () => void;
  onRemoveKey: () => void;
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
        {credential === 'oauth' ? (
          <DropdownMenu.Item onClick={onSignOut}>Sign out</DropdownMenu.Item>
        ) : (
          <>
            <DropdownMenu.Item onClick={onUpdateKey}>Update key</DropdownMenu.Item>
            <DropdownMenu.Item onClick={onRemoveKey}>Remove key</DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
