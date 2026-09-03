import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
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
import { SettingsCard } from './SettingsCard';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';

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

const SOURCE_VARIANT: Record<ProviderInfo['source'], BadgeVariant> = {
  oauth: 'green',
  'oauth-user': 'green',
  'oauth-org': 'blue',
  stored: 'green',
  'stored-user': 'green',
  'stored-org': 'blue',
  env: 'blue',
  none: 'neutral',
};

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Credential source badge(s). When a personal credential shadows an org-wide
 * key, both badges render so it's clear a shared key also exists.
 */
function SourceBadges({ provider }: { provider: ProviderInfo }) {
  const shadowedOrg =
    provider.orgKey === true && (provider.source === 'stored-user' || provider.source === 'oauth-user');
  return (
    <span className="flex items-center gap-1">
      <Badge size="sm" variant={SOURCE_VARIANT[provider.source]}>
        {SOURCE_LABEL[provider.source]}
      </Badge>
      {shadowedOrg && (
        <Badge size="sm" variant="blue">
          {provider.orgCredential === 'oauth' ? 'Org sign-in' : 'Org key'}
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
  signedInScopes,
  onSelect,
  onClose,
}: {
  provider: ProviderInfo;
  /** Scopes that already have an OAuth credential; disabled in the picker. */
  signedInScopes: Array<'user' | 'org'>;
  onSelect: (scope: 'user' | 'org') => void;
  onClose: () => void;
}) {
  const displayName = providerDisplayName(provider.provider);
  const [scope, setScope] = useState<'user' | 'org'>(signedInScopes.includes('user') ? 'org' : 'user');
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in to {displayName}</DialogTitle>
          <DialogDescription>Choose who can use this sign-in before authorizing.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Txt as="span" variant="ui-sm" className="text-icon4">
              Who can use this sign-in
            </Txt>
            <ButtonsGroup spacing="close" role="group" aria-label="Sign-in access">
              {(
                [
                  { value: 'user', label: 'Just me' },
                  { value: 'org', label: 'Everyone in org' },
                ] as const
              ).map(option => {
                const alreadySignedIn = signedInScopes.includes(option.value);
                return (
                  <Button
                    key={option.value}
                    variant={scope === option.value ? 'primary' : 'outline'}
                    size="sm"
                    aria-pressed={scope === option.value}
                    disabled={alreadySignedIn}
                    title={alreadySignedIn ? 'Already signed in at this scope' : undefined}
                    onClick={() => setScope(option.value)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </ButtonsGroup>
          </div>
          {scope === 'org' && (
            <Txt as="p" variant="ui-sm" className="text-icon4" role="note">
              Everyone in your organization will be able to run models through this {displayName} account.
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSelect(scope)}>
            Continue
          </Button>
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

  // Per-scope OAuth status. Falls back to the legacy `source` field so rows
  // stay correct in local mode and while /auth/me is still loading.
  const oauthScopes = (provider: ProviderInfo): Array<'user' | 'org'> => {
    const scopes: Array<'user' | 'org'> = [];
    if (provider.userCredential === 'oauth' || provider.source === 'oauth' || provider.source === 'oauth-user') {
      scopes.push('user');
    }
    if (provider.orgCredential === 'oauth' || provider.source === 'oauth-org') scopes.push('org');
    return scopes;
  };

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

  // Sign in is offered whenever a scope the caller can write is still open:
  // personal always, org only for admins.
  const canSignIn = (provider: ProviderInfo) => {
    const scopes = oauthScopes(provider);
    if (!scopes.includes('user')) return true;
    return authEnabled && canWriteOrgKey && !scopes.includes('org');
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) {
      cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
    }
  };

  const signOut = (provider: ProviderInfo, scope: 'user' | 'org') => {
    signOutMutation.mutate(
      {
        provider: provider.provider,
        ...(authEnabled ? { scope } : {}),
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
                const scopes = oauthScopes(provider);
                const showScopeLabels = scopes.length > 0 && authEnabled;
                return (
                  <SettingsRow key={provider.provider} variant="factory" label={displayName}>
                    <span className="flex items-center gap-2">
                      <SourceBadges provider={provider} />
                      {scopes.map(scope => {
                        // Removing the shared org sign-in is admin-only.
                        if (scope === 'org' && !canWriteOrgKey) return null;
                        const label = showScopeLabels ? (scope === 'org' ? 'Sign out org' : 'Sign out me') : 'Sign out';
                        return (
                          <Button
                            key={scope}
                            variant="outline"
                            size="sm"
                            aria-label={
                              scope === 'org' ? `Sign out of ${displayName} for the org` : `Sign out of ${displayName}`
                            }
                            disabled={isSigningOut(provider)}
                            onClick={() => signOut(provider, scope)}
                          >
                            {isSigningOut(provider) ? 'Signing out…' : label}
                          </Button>
                        );
                      })}
                      {canSignIn(provider) && (
                        <Button
                          variant={scopes.length === 0 ? 'primary' : 'outline'}
                          size="sm"
                          aria-label={`Sign in to ${displayName}`}
                          disabled={startOAuthMutation.isPending}
                          onClick={() => requestSignIn(provider)}
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
                const storedKey =
                  provider.source === 'stored' || provider.source === 'stored-user' || provider.source === 'stored-org';
                return (
                  <SettingsRow key={provider.provider} variant="factory" label={displayName}>
                    <span className="flex items-center gap-2">
                      <SourceBadges provider={provider} />
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
          signedInScopes={oauthScopes(scopeDialogProvider)}
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
