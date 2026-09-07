import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
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
import { SettingsCard } from './SettingsCard';
import { ScopeSwap, useScopeControl } from './SettingsScope';
import type { SettingsScope } from './SettingsScope';
import { SettingsSubsection } from './SettingsSubsection';

type CredentialScope = 'user' | 'org';
type Credential = NonNullable<ProviderInfo['userCredential']>;

const CREDENTIAL_LABEL: Record<Credential, string> = { oauth: 'Signed in', api_key: 'Key saved' };

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Credential held at one scope. The legacy `source` field stands in for the
 * per-scope fields in local mode and while /auth/me is still loading.
 */
function credentialAt(provider: ProviderInfo, scope: CredentialScope): Credential | undefined {
  if (scope === 'org') {
    if (provider.orgCredential) return provider.orgCredential;
    if (provider.source === 'oauth-org') return 'oauth';
    if (provider.source === 'stored-org') return 'api_key';
    return undefined;
  }
  if (provider.userCredential) return provider.userCredential;
  if (provider.source === 'oauth' || provider.source === 'oauth-user') return 'oauth';
  if (provider.source === 'stored' || provider.source === 'stored-user') return 'api_key';
  return undefined;
}

interface RowScope {
  scope: CredentialScope;
  authEnabled: boolean;
}

function orgCoverage(provider: ProviderInfo, { scope, authEnabled }: RowScope): Credential | undefined {
  return authEnabled && scope === 'user' ? credentialAt(provider, 'org') : undefined;
}

function StatusBadge({ provider, rowScope }: { provider: ProviderInfo; rowScope: RowScope }) {
  const own = credentialAt(provider, rowScope.scope);
  if (own) {
    return (
      <Badge size="sm" variant="green">
        {CREDENTIAL_LABEL[own]}
      </Badge>
    );
  }
  if (orgCoverage(provider, rowScope)) {
    return (
      <Badge size="sm" variant="blue">
        Covered by org
      </Badge>
    );
  }
  if (provider.source === 'env') {
    return (
      <Badge size="sm" variant="blue">
        From env
      </Badge>
    );
  }
  return (
    <Badge size="sm" variant="neutral">
      Not set
    </Badge>
  );
}

/**
 * Provider credential management: OAuth sign-in on one tab, API keys on the
 * other. The section's scope switch decides whether rows show and edit the
 * caller's personal credentials or the org-wide ones (admins only).
 */
export function ProviderAccessSection({ description }: { description?: string }) {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const signOutMutation = useSignOutProviderOAuth();
  const removeKeyMutation = useRemoveProviderKey();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const [search, setSearch] = useState('');
  const [startingProvider, setStartingProvider] = useState<string>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  const providers = providersQuery.data ?? [];
  const authEnabled = authQuery.data?.authEnabled === true;
  const canWriteOrgKey = !authEnabled || (orgKeyAdminQuery.data ?? true);
  const scopeOptions: SettingsScope[] = authEnabled && canWriteOrgKey ? ['personal', 'org'] : ['personal'];
  const scopeControl = useScopeControl(scopeOptions);
  const scope: CredentialScope = scopeControl.shown === 'org' ? 'org' : 'user';
  const rowScope: RowScope = { scope, authEnabled };
  const scopeArg = authEnabled ? { scope } : {};

  const oauthProviders = providers
    .filter(provider => provider.oauth?.supported === true)
    .sort((left, right) => left.provider.localeCompare(right.provider));

  // OAuth-capable providers usually accept API keys too, so the API-key tab
  // lists every provider, credentialed-first.
  const apiKeyProviders = providers.toSorted((left, right) => {
    const leftHas = credentialAt(left, scope) !== undefined;
    const rightHas = credentialAt(right, scope) !== undefined;
    if (leftHas !== rightHas) return leftHas ? -1 : 1;
    return left.provider.localeCompare(right.provider);
  });
  const query = search.trim().toLowerCase();
  const results = query
    ? apiKeyProviders.filter(provider => provider.provider.toLowerCase().includes(query))
    : apiKeyProviders;

  const startOAuth = async (provider: ProviderInfo) => {
    const modes = provider.oauth?.modes ?? [];
    setStartingProvider(provider.provider);
    try {
      const session = await startOAuthMutation.mutateAsync({
        provider: provider.provider,
        mode: modes.length === 1 ? modes[0] : undefined,
        ...scopeArg,
      });
      setActiveOAuth({ provider: provider.provider, session });
    } catch {
      // Mutation error is rendered below.
    } finally {
      setStartingProvider(undefined);
    }
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

  const isSigningOut = (provider: ProviderInfo) =>
    signOutMutation.isPending && signOutMutation.variables?.provider === provider.provider;
  const isRemoving = (provider: ProviderInfo) =>
    removeKeyMutation.isPending && removeKeyMutation.variables?.provider === provider.provider;

  const requestError = providersQuery.error ?? startOAuthMutation.error ?? cancelOAuthMutation.error;
  const error = requestError instanceof Error ? requestError.message : undefined;

  return (
    <Tabs defaultTab="oauth">
      <SettingsSubsection
        title="Provider access"
        description={description}
        scope={scopeControl}
        action={
          <TabList variant="pill">
            <Tab value="oauth">Sign in with a provider</Tab>
            <Tab value="api-key">Connect with API key</Tab>
          </TabList>
        }
      >
        <div className="flex flex-col gap-3">
          {error && (
            <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
              {error}
            </Txt>
          )}

          <TabContent value="oauth" className="flex flex-col gap-3">
            <ScopeSwap control={scopeControl}>
              <SettingsCard>
                {providersQuery.isPending ? (
                  <div className="px-4 py-3">
                    <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
                  </div>
                ) : oauthProviders.length === 0 ? (
                  <Txt as="p" variant="ui-sm" className="text-icon3 px-4 py-3">
                    No providers support sign in.
                  </Txt>
                ) : (
                  oauthProviders.map(provider => {
                    const displayName = providerDisplayName(provider.provider);
                    const own = credentialAt(provider, scope);
                    const signedIn = own === 'oauth';
                    const covered = own !== undefined || orgCoverage(provider, rowScope) !== undefined;
                    return (
                      <SettingsRow key={provider.provider} variant="factory" label={displayName}>
                        <span className="flex items-center gap-2">
                          <StatusBadge provider={provider} rowScope={rowScope} />
                          {signedIn ? (
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={
                                scope === 'org'
                                  ? `Sign out of ${displayName} for the org`
                                  : `Sign out of ${displayName}`
                              }
                              disabled={isSigningOut(provider)}
                              onClick={() => signOut(provider)}
                            >
                              {isSigningOut(provider) ? 'Signing out…' : 'Sign out'}
                            </Button>
                          ) : (
                            <Button
                              variant={covered ? 'outline' : 'primary'}
                              size="sm"
                              aria-label={`Sign in to ${displayName}`}
                              disabled={startOAuthMutation.isPending}
                              onClick={() => void startOAuth(provider)}
                            >
                              {startingProvider === provider.provider ? 'Starting…' : 'Sign in'}
                            </Button>
                          )}
                        </span>
                      </SettingsRow>
                    );
                  })
                )}
              </SettingsCard>
            </ScopeSwap>
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

            <ScopeSwap control={scopeControl}>
              <SettingsCard className="max-h-[280px] overflow-y-auto">
                {providersQuery.isPending ? (
                  <div className="px-4 py-3">
                    <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
                  </div>
                ) : results.length === 0 ? (
                  <Txt as="p" variant="ui-sm" className="text-icon3 px-4 py-3">
                    {query ? `No providers match “${search.trim()}”.` : 'No API key providers are available.'}
                  </Txt>
                ) : (
                  results.map(provider => {
                    const displayName = providerDisplayName(provider.provider);
                    const storedKey = credentialAt(provider, scope) === 'api_key';
                    return (
                      <SettingsRow key={provider.provider} variant="factory" label={displayName}>
                        <span className="flex items-center gap-2">
                          <StatusBadge provider={provider} rowScope={rowScope} />
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
                      </SettingsRow>
                    );
                  })
                )}
              </SettingsCard>
            </ScopeSwap>
          </TabContent>

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
      </SettingsSubsection>
    </Tabs>
  );
}
