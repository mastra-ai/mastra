import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { SegmentedControl, SegmentedControlItem } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../api/types';
import { useOrgKeyAdminQuery, useSaveProviderKey } from '../../../../hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

type KeyScope = 'user' | 'org';

const SCOPED_KEY_ACCESS: Record<KeyScope, string> = {
  org: 'Everyone in your organization can use this key.',
  user: 'Only you can use this key. Shared organization access stays unchanged.',
};

function credentialAtScope(provider: ProviderInfo, scope: KeyScope) {
  return scope === 'org' ? provider.orgCredential : provider.userCredential;
}

interface AddApiKeyDialogProps {
  provider: ProviderInfo;
  authEnabled: boolean;
  /**
   * Scope preselected when the dialog opens. Shared contexts (factory setup)
   * pass `'org'` so the whole team can use the key; personal settings keep the
   * `'user'` default. An existing org key always wins so edits don't silently
   * narrow a shared key.
   */
  defaultScope?: KeyScope;
  fixedScope?: KeyScope;
  onClose: () => void;
}

/** Dialog for adding or updating a provider API key, with an org/user scope choice when auth is enabled. */
export function AddApiKeyDialog({
  provider,
  authEnabled,
  defaultScope = 'user',
  fixedScope,
  onClose,
}: AddApiKeyDialogProps) {
  const displayName = providerDisplayName(provider.provider);
  const saveKeyMutation = useSaveProviderKey();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const canWriteOrgKey = !authEnabled || (orgKeyAdminQuery.data ?? true);
  const preferredScope = provider.source === 'stored-org' ? 'org' : defaultScope;
  const [keyDraft, setKeyDraft] = useState('');
  const writableScope = canWriteOrgKey ? preferredScope : 'user';
  const [scope, setScope] = useState<KeyScope>(fixedScope ?? writableScope);

  const replacesSignIn = fixedScope !== undefined && credentialAtScope(provider, fixedScope) === 'oauth';
  const description = fixedScope
    ? SCOPED_KEY_ACCESS[fixedScope]
    : 'The key is stored securely and never displayed again.';
  const error = saveKeyMutation.error instanceof Error ? saveKeyMutation.error.message : undefined;
  const personalOnlyWarning = authEnabled && preferredScope === 'org' && !canWriteOrgKey;

  const saveKey = async () => {
    const key = keyDraft.trim();
    if (!key || saveKeyMutation.isPending) return;
    try {
      await saveKeyMutation.mutateAsync({
        provider: provider.provider,
        key,
        envVar: provider.envVar,
        ...(authEnabled ? { scope } : {}),
      });
      onClose();
    } catch {}
  };

  const close = () => {
    if (!saveKeyMutation.isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && close()} pending={saveKeyMutation.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key for {displayName}</DialogTitle>
          <DialogDescription>
            {description}
            {replacesSignIn && ' Saving replaces the provider sign-in at this scope.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            autoFocus
            type="password"
            aria-label={`API key for ${displayName}`}
            placeholder="Paste API key"
            value={keyDraft}
            disabled={saveKeyMutation.isPending}
            onChange={event => setKeyDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') void saveKey();
              if (event.key === 'Escape') close();
            }}
          />
          {authEnabled && !fixedScope && (
            <div className="flex items-center justify-between gap-4">
              <Txt as="span" variant="caption" tone="muted">
                Who can use this key
              </Txt>
              <SegmentedControl
                aria-label="API key access"
                value={scope}
                onValueChange={setScope}
                disabled={saveKeyMutation.isPending}
              >
                <SegmentedControlItem value="user">Just me</SegmentedControlItem>
                <SegmentedControlItem
                  value="org"
                  disabled={!canWriteOrgKey}
                  title={canWriteOrgKey ? undefined : 'Only org admins can share a key with everyone'}
                >
                  Everyone in org
                </SegmentedControlItem>
              </SegmentedControl>
            </div>
          )}
          {personalOnlyWarning && (
            <Txt as="p" variant="caption" tone="muted" role="note">
              Only you will be able to use this key. Ask an org admin to add a shared {displayName} key so teammates can
              use it too.
            </Txt>
          )}
          {error && (
            <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
              {error}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!keyDraft.trim()} onConfirm={() => void saveKey()}>
            {saveKeyMutation.isPending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
