import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
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
  onClose: () => void;
}

/** Dialog for adding or updating a provider API key, with an org/user scope choice when auth is enabled. */
export function AddApiKeyDialog({ provider, authEnabled, defaultScope = 'user', onClose }: AddApiKeyDialogProps) {
  const displayName = providerDisplayName(provider.provider);
  const saveKeyMutation = useSaveProviderKey();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const canWriteOrgKey = !authEnabled || (orgKeyAdminQuery.data ?? true);
  const preferredScope = provider.source === 'stored-org' ? 'org' : defaultScope;
  const [keyDraft, setKeyDraft] = useState('');
  const [scope, setScope] = useState<'user' | 'org'>(canWriteOrgKey ? preferredScope : 'user');

  const error = saveKeyMutation.error instanceof Error ? saveKeyMutation.error.message : undefined;
  // A shared context wanted an org-wide key but this caller can't write one —
  // tell them up front instead of letting teammates find out at run time.
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
    } catch {
      // Mutation error is rendered below.
    }
  };

  const close = () => {
    if (!saveKeyMutation.isPending) onClose();
  };

  return (
    <Dialog open onOpenChange={open => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key for {displayName}</DialogTitle>
          <DialogDescription>The key is stored securely and never displayed again.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {provider.provider === 'opencode' && (
            <Txt as="p" variant="ui-sm" className="text-icon4">
              Sign in at{' '}
              <a href="https://opencode.ai/auth" target="_blank" rel="noreferrer" className="underline">
                opencode.ai/auth
              </a>{' '}
              and copy your key. Free models also work without one.
            </Txt>
          )}
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
          {authEnabled && (
            <div className="flex items-center justify-between gap-4">
              <Txt as="span" variant="ui-sm" className="text-icon4">
                Who can use this key
              </Txt>
              <ButtonsGroup spacing="close" role="group" aria-label="API key access">
                {(
                  [
                    { value: 'user', label: 'Just me' },
                    { value: 'org', label: 'Everyone in org' },
                  ] as const
                ).map(option => (
                  <Button
                    key={option.value}
                    variant={scope === option.value ? 'primary' : 'outline'}
                    size="sm"
                    aria-pressed={scope === option.value}
                    disabled={saveKeyMutation.isPending || (option.value === 'org' && !canWriteOrgKey)}
                    title={
                      option.value === 'org' && !canWriteOrgKey
                        ? 'Only org admins can share a key with everyone'
                        : undefined
                    }
                    onClick={() => setScope(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </ButtonsGroup>
            </div>
          )}
          {personalOnlyWarning && (
            <Txt as="p" variant="ui-sm" className="text-icon4" role="note">
              Only you will be able to use this key. Ask an org admin to add a shared {displayName} key so teammates can
              use it too.
            </Txt>
          )}
          {error && (
            <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
              {error}
            </Txt>
          )}
        </DialogBody>
        <DialogFooter>
          <Button disabled={saveKeyMutation.isPending} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={saveKeyMutation.isPending || !keyDraft.trim()}
            onClick={() => void saveKey()}
          >
            {saveKeyMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
