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
import { SegmentedControl } from '@mastra/playground-ui/components/SegmentedControl';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../api/types';
import { useOrgKeyAdminQuery, useSaveProviderKey } from '../../../../hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

interface AddApiKeyDialogProps {
  provider: ProviderInfo;
  authEnabled: boolean;
  /**
   * Scope preselected when the dialog opens. Shared contexts (factory setup)
   * pass `'org'` so the whole team can use the key; personal settings keep the
   * `'user'` default. An existing org key always wins so edits don't silently
   * narrow a shared key.
   */
  defaultScope?: 'user' | 'org';
  fixedScope?: 'user' | 'org';
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
  const [scope, setScope] = useState<'user' | 'org'>(fixedScope ?? (canWriteOrgKey ? preferredScope : 'user'));

  const error = saveKeyMutation.error instanceof Error ? saveKeyMutation.error.message : undefined;
  const personalOnlyWarning = authEnabled && preferredScope === 'org' && !canWriteOrgKey;

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
          <DialogDescription>The key is stored securely and never displayed again.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            autoFocus
            type="password"
            aria-label={`API key for ${displayName}`}
            placeholder="Paste API key"
            value={keyDraft}
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
                options={[
                  { value: 'user', label: 'Just me' },
                  {
                    value: 'org',
                    label: 'Everyone in org',
                    disabled: !canWriteOrgKey,
                    title: canWriteOrgKey ? undefined : 'Only org admins can share a key with everyone',
                  },
                ]}
              />
            </div>
          )}
          {personalOnlyWarning && (
            <Txt as="p" variant="caption" tone="muted" role="note">
              Only you will be able to use this key. Ask an org admin to add a shared {displayName} key so teammates can
              use it too.
            </Txt>
          )}
          {error && (
            <Txt as="p" variant="caption" className="text-destructive-indicator">
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
