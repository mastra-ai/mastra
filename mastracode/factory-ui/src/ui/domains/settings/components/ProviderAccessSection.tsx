import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { Input } from '@mastra/playground-ui/components/Input';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../api/types';
import {
  useCancelProviderOAuth,
  useOrgKeyAdminQuery,
  useProvidersQuery,
  useRemoveProviderKey,
  useSignOutProviderOAuth,
  useStartProviderOAuth,
} from '../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { AddApiKeyDialog } from './AddApiKeyDialog';
import { ProviderOAuthDialog } from './ProviderOAuthDialog';
import { providerDisplayName } from './provider-display-name';

const SOURCE_LABEL: Record<ProviderInfo['source'], string> = {
  oauth: 'Signed in',
  'oauth-user': 'Signed in',
  'oauth-org': 'Org sign-in',
  stored: 'Key saved',
  'stored-user': 'Personal key',
  'stored-org': 'Org key',
  env: 'From env',
  none: 'Not set',
};

const SOURCE_VARIANT: Record<ProviderInfo['source'], 'success' | 'info' | 'default'> = {
  oauth: 'success',
  'oauth-user': 'success',
  'oauth-org': 'info',
  stored: 'success',
  'stored-user': 'success',
  'stored-org': 'info',
  env: 'info',
  none: 'default',
};

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

const API_KEY_LIST_MAX_HEIGHT = 280;
const PROVIDER_LIST_COLUMNS = '1fr auto auto';

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Credential source badge(s). When a personal credential shadows an org-wide
 * key, both badges render so it's clear a shared key also exists.
 */
function SourceBadges({ provider }: { provider: ProviderInfo }) {
  const shadowedOrgKey =
    provider.orgKey === true && (provider.source === 'stored-user' || provider.source === 'oauth-user');
  return (
    <span className="flex items-center gap-1">
      <Badge size="sm" variant={SOURCE_VARIANT[provider.source]}>
        {SOURCE_LABEL[provider.source]}
      </Badge>
      {shadowedOrgKey && (
        <Badge size="sm" variant="info">
          Org key
        </Badge>
      )}
    </span>
  );
}

/**
 * Per-provider scope choice for org admins before starting an OAuth flow.
 * Scope is fixed at flow start (the server stores it on the login session),
 * so it has to be picked here rather than after authorization.
 */
function OAuthScopeDialog({
  provider,
  onSelect,
  onClose,
}: {
  provider: ProviderInfo;
  onSelect: (scope: 'user' | 'org') => void;
  onClose: () => void;
}) {
  const displayName = providerDisplayName(provider.provider);
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to {displayName}</DialogTitle>
          <DialogDescription>Who can use this sign-in?</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => onSelect('user')}>
            Just me
          </Button>
          <Button variant="outline" onClick={() => onSelect('org')}>
            Everyone in org
          </Button>
          <Txt as="p" variant="ui-sm" className="text-icon4">
            Org-wide sign-ins share this account&apos;s access with everyone in your organization.
          </Txt>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Provider credential management as a tabbed subsection of the Model settings
 * page: OAuth sign-in on one tab, API keys on the other.
 */
export function ProviderAccessSection() {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const signOutMutation = useSignOutProviderOAuth();
  const removeKeyMutation = useRemoveProviderKey();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const [search, setSearch] = useState('');
  const [scopeDialogProvider, setScopeDialogProvider] = useState<ProviderInfo>();
  const [startingProvider, setStartingProvider] = useState<string>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  const providers = providersQuery.data ?? [];
  const authEnabled = authQuery.data?.authEnabled === true;
  const oauthProviders = providers
    .filter(provider => provider.oauth?.supported === true)
    .sort((left, right) => left.provider.localeCompare(right.provider));

  // OAuth-capable providers usually accept API keys too, so the API-key tab
  // lists every provider, credentialed-first.
  const apiKeyProviders = [...providers].sort((left, right) => {
    if ((left.source !== 'none') !== (right.source !== 'none')) return left.source !== 'none' ? -1 : 1;
    return left.provider.localeCompare(right.provider);
  });
  const query = search.trim().toLowerCase();
  const results = query
    ? apiKeyProviders.filter(provider => provider.provider.toLowerCase().includes(query))
    : apiKeyProviders;

  const canWriteOrgKey = !authEnabled || (orgKeyAdminQuery.data ?? true);

  const startOAuth = async (provider: ProviderInfo, scope: 'user' | 'org') => {
    const modes = provider.oauth?.modes ?? [];
    setScopeDialogProvider(undefined);
    setStartingProvider(provider.provider);
    try {
      const session = await startOAuthMutation.mutateAsync({
        provider: provider.provider,
        mode: modes.length === 1 ? modes[0] : undefined,
        ...(authEnabled ? { scope } : {}),
      });
      setActiveOAuth({ provider: provider.provider, session });
    } catch {
      // Mutation error is rendered below.
    } finally {
      setStartingProvider(undefined);
    }
  };

  // Org admins pick who the sign-in is for, per provider; everyone else signs
  // in personally without an extra step.
  const requestSignIn = (provider: ProviderInfo) => {
    if (authEnabled && canWriteOrgKey) {
      setScopeDialogProvider(provider);
      return;
    }
    void startOAuth(provider, 'user');
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) {
      cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
    }
  };

  const signOut = (provider: ProviderInfo) => {
    signOutMutation.mutate(
      {
        provider: provider.provider,
        ...(authEnabled && provider.source === 'oauth-org' ? { scope: 'org' as const } : {}),
      },
      { onError: error => toast.error(mutationErrorMessage(error, 'Failed to sign out')) },
    );
  };

  const removeKey = (provider: ProviderInfo) => {
    removeKeyMutation.mutate(
      {
        provider: provider.provider,
        ...(authEnabled ? { scope: provider.source === 'stored-org' ? 'org' : 'user' } : {}),
      },
      { onError: error => toast.error(mutationErrorMessage(error, 'Failed to remove API key')) },
    );
  };

  const isSigningOut = (provider: ProviderInfo) =>
    signOutMutation.isPending && signOutMutation.variables?.provider === provider.provider;
  const isRemoving = (provider: ProviderInfo) =>
    removeKeyMutation.isPending && removeKeyMutation.variables?.provider === provider.provider;

  const requestError = providersQuery.error ?? startOAuthMutation.error ?? cancelOAuthMutation.error;
  const error = requestError instanceof Error ? requestError.message : undefined;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      <Tabs defaultTab="oauth">
        <TabList variant="pill">
          <Tab value="oauth">Sign in with a provider</Tab>
          <Tab value="api-key">Connect with API key</Tab>
        </TabList>

        <TabContent value="oauth" className="flex flex-col gap-3">
          {providersQuery.isPending ? (
            <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
          ) : oauthProviders.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              No providers support sign in.
            </Txt>
          ) : (
            <DataList aria-label="Sign in providers" variant="lined" columns={PROVIDER_LIST_COLUMNS}>
              {oauthProviders.map(provider => {
                const displayName = providerDisplayName(provider.provider);
                const signedIn =
                  provider.source === 'oauth' || provider.source === 'oauth-user' || provider.source === 'oauth-org';
                return (
                  <DataList.RowStatic key={provider.provider}>
                    <DataList.NameCell>{displayName}</DataList.NameCell>
                    <DataList.Cell>
                      <SourceBadges provider={provider} />
                    </DataList.Cell>
                    <DataList.Cell className="justify-end">
                      {signedIn ? (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Sign out of ${displayName}`}
                          disabled={isSigningOut(provider)}
                          onClick={() => signOut(provider)}
                        >
                          {isSigningOut(provider) ? 'Signing out…' : 'Sign out'}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          aria-label={`Sign in to ${displayName}`}
                          disabled={startOAuthMutation.isPending}
                          onClick={() => requestSignIn(provider)}
                        >
                          {startingProvider === provider.provider ? 'Starting…' : 'Sign in'}
                        </Button>
                      )}
                    </DataList.Cell>
                  </DataList.RowStatic>
                );
              })}
            </DataList>
          )}
        </TabContent>

        <TabContent value="api-key" className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="text-icon3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search providers to add an API key…"
              value={search}
              onChange={event => setSearch(event.target.value)}
              aria-label="Search providers"
              className="pl-8"
            />
          </div>

          {providersQuery.isPending ? (
            <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
          ) : results.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {query ? `No providers match “${search.trim()}”.` : 'No API key providers are available.'}
            </Txt>
          ) : (
            <DataList
              aria-label="API key providers"
              variant="lined"
              columns={PROVIDER_LIST_COLUMNS}
              maxHeight={`${API_KEY_LIST_MAX_HEIGHT}px`}
              className="min-h-0"
            >
              {results.map(provider => {
                const displayName = providerDisplayName(provider.provider);
                const storedKey =
                  provider.source === 'stored' || provider.source === 'stored-user' || provider.source === 'stored-org';
                return (
                  <DataList.RowStatic key={provider.provider}>
                    <DataList.NameCell>{displayName}</DataList.NameCell>
                    <DataList.Cell>
                      <SourceBadges provider={provider} />
                    </DataList.Cell>
                    <DataList.Cell className="justify-end">
                      <span className="flex items-center gap-2">
                        <Button
                          size="sm"
                          aria-label={`${storedKey ? 'Update key' : 'Add API key'} for ${displayName}`}
                          disabled={isRemoving(provider)}
                          onClick={() => setKeyDialogProvider(provider)}
                        >
                          {storedKey ? 'Update key' : 'Add API key'}
                        </Button>
                        {storedKey && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Remove key for ${displayName}`}
                            disabled={isRemoving(provider)}
                            onClick={() => removeKey(provider)}
                          >
                            {isRemoving(provider) ? 'Removing…' : 'Remove'}
                          </Button>
                        )}
                      </span>
                    </DataList.Cell>
                  </DataList.RowStatic>
                );
              })}
            </DataList>
          )}
        </TabContent>
      </Tabs>

      {keyDialogProvider && (
        <AddApiKeyDialog
          provider={keyDialogProvider}
          authEnabled={authEnabled}
          onClose={() => setKeyDialogProvider(undefined)}
        />
      )}

      {scopeDialogProvider && (
        <OAuthScopeDialog
          provider={scopeDialogProvider}
          onSelect={scope => void startOAuth(scopeDialogProvider, scope)}
          onClose={() => setScopeDialogProvider(undefined)}
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
