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
import { Input } from '@mastra/playground-ui/components/Input';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ProviderInfo } from '../../../../../shared/api/types';
import { useSaveProviderKey } from '../../../../../shared/hooks/use-providers';
import { providerDisplayName } from './provider-display-name';

interface AddApiKeyDialogProps {
  provider: ProviderInfo;
  authEnabled: boolean;
  onClose: () => void;
}

/** Dialog for adding or updating a provider API key, with an org/user scope choice when auth is enabled. */
export function AddApiKeyDialog({ provider, authEnabled, onClose }: AddApiKeyDialogProps) {
  const displayName = providerDisplayName(provider.provider);
  const saveKeyMutation = useSaveProviderKey();
  const [keyDraft, setKeyDraft] = useState('');
  const [scope, setScope] = useState<'user' | 'org'>(provider.source === 'stored-org' ? 'org' : 'user');

  const error = saveKeyMutation.error instanceof Error ? saveKeyMutation.error.message : undefined;

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
