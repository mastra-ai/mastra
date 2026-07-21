import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check } from 'lucide-react';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../../shared/api/types';
import {
  useRemoveProviderKey,
  useSaveProviderKey,
  useSignOutProviderOAuth,
} from '../../../../../shared/hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

const SOURCE_LABEL: Record<ProviderInfo['source'], string> = {
  oauth: 'Signed in',
  'oauth-user': 'Signed in',
  stored: 'Key saved',
  'stored-user': 'Key saved',
  'stored-org': 'Org key',
  env: 'From env',
  none: 'Not set',
};

const SOURCE_VARIANT: Record<ProviderInfo['source'], 'success' | 'info' | 'default'> = {
  oauth: 'success',
  'oauth-user': 'success',
  stored: 'success',
  'stored-user': 'success',
  'stored-org': 'info',
  env: 'info',
  none: 'default',
};

interface ProviderRowProps {
  provider: ProviderInfo;
  authEnabled: boolean;
  disabled?: boolean;
  startingOAuth: boolean;
  onStartOAuth: (provider: string, mode?: string) => Promise<void>;
}

export function ProviderRow({
  provider,
  authEnabled,
  disabled = false,
  startingOAuth,
  onStartOAuth,
}: ProviderRowProps) {
  const displayName = providerDisplayName(provider.provider);
  const saveKeyMutation = useSaveProviderKey();
  const removeKeyMutation = useRemoveProviderKey();
  const signOutMutation = useSignOutProviderOAuth();
  const [editing, setEditing] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [scope, setScope] = useState<'user' | 'org'>(provider.source === 'stored-org' ? 'org' : 'user');

  const busy =
    disabled || saveKeyMutation.isPending || removeKeyMutation.isPending || signOutMutation.isPending || startingOAuth;
  const mutationError = saveKeyMutation.error ?? removeKeyMutation.error ?? signOutMutation.error;
  const error = mutationError instanceof Error ? mutationError.message : undefined;
  const signedIn = provider.source === 'oauth' || provider.source === 'oauth-user';
  const storedKey =
    provider.source === 'stored' || provider.source === 'stored-user' || provider.source === 'stored-org';

  const saveKey = async () => {
    const key = keyDraft.trim();
    if (!key) return;
    try {
      await saveKeyMutation.mutateAsync({
        provider: provider.provider,
        key,
        envVar: provider.envVar,
        ...(authEnabled ? { scope } : {}),
      });
      setEditing(false);
      setKeyDraft('');
    } catch {
      // Mutation error is rendered below.
    }
  };

  const removeKey = async () => {
    try {
      await removeKeyMutation.mutateAsync({
        provider: provider.provider,
        ...(authEnabled ? { scope: provider.source === 'stored-org' ? 'org' : 'user' } : {}),
      });
    } catch {
      // Mutation error is rendered below.
    }
  };

  const signOut = async () => {
    try {
      await signOutMutation.mutateAsync({ provider: provider.provider });
    } catch {
      // Mutation error is rendered below.
    }
  };

  const startOAuth = async () => {
    const modes = provider.oauth?.modes ?? [];
    await onStartOAuth(provider.provider, modes.length === 1 ? modes[0] : undefined);
  };

  return (
    <li className="flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {provider.source !== 'none' && <Check size={13} className="shrink-0 text-accent1" />}
          <Txt as="span" variant="ui-md" className="truncate text-icon6">
            {displayName}
          </Txt>
          <Badge size="sm" variant={SOURCE_VARIANT[provider.source]}>
            {SOURCE_LABEL[provider.source]}
          </Badge>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            {provider.oauth?.supported &&
              (signedIn ? (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void signOut()}>
                  {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
                </Button>
              ) : (
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void startOAuth()}>
                  {startingOAuth ? 'Starting…' : 'Sign in'}
                </Button>
              ))}
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(true);
                setKeyDraft('');
                setScope(provider.source === 'stored-org' ? 'org' : 'user');
              }}
            >
              {storedKey ? 'Update key' : 'Add key'}
            </Button>
            {storedKey && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void removeKey()}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-3 pl-5">
          <Input
            autoFocus
            type="password"
            size="sm"
            aria-label={`API key for ${displayName}`}
            placeholder="Paste API key"
            value={keyDraft}
            onChange={event => setKeyDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void saveKey();
              if (event.key === 'Escape') {
                setEditing(false);
                setKeyDraft('');
              }
            }}
          />
          {authEnabled && (
            <RadioGroup
              aria-label="API key access"
              value={scope}
              onValueChange={value => setScope(value === 'org' ? 'org' : 'user')}
              className="grid-cols-2"
            >
              <label className="flex cursor-pointer items-center gap-2">
                <RadioGroupItem value="user" />
                <Txt as="span" variant="ui-sm">
                  Just me
                </Txt>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <RadioGroupItem value="org" />
                <Txt as="span" variant="ui-sm">
                  Everyone in org
                </Txt>
              </label>
            </RadioGroup>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setKeyDraft('');
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={busy || !keyDraft.trim()} onClick={() => void saveKey()}>
              {saveKeyMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Txt as="p" variant="ui-sm" className="pl-5 text-notice-destructive-fg">
          {error}
        </Txt>
      )}
    </li>
  );
}
