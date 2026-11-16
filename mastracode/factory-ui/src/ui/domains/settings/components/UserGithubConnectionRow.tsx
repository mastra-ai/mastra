import { Button } from '@mastra/playground-ui/components/Button';
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
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import {
  useConnectOwnGithubMutation,
  useDeleteOwnGithubPatMutation,
  useOwnGithubQuery,
  useSaveOwnGithubPatMutation,
} from '../../../../hooks/useGithubApps';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { connectUserGithub } from '../../workspaces/services/github';
import { IntegrationItem } from './IntegrationItem';
import { IconChainLink3 } from '@mastra/playground-ui/icons/central/IconChainLink3';
import { IconKey2 } from '@mastra/playground-ui/icons/central/IconKey2';

export function UserGithubConnectionRow() {
  const status = useGithubStatusQuery().data;
  if (!status || status.installations.length === 0) return undefined;
  return status.mode === 'connect' ? <OwnGithubRow /> : <LegacyUserGithubRow status={status} />;
}

function LegacyUserGithubRow({ status }: { status: NonNullable<ReturnType<typeof useGithubStatusQuery>['data']> }) {
  const { baseUrl } = useApiConfig();
  if (status.userConnected) {
    return (
      <IntegrationItem provider="github" name="GitHub" description={`@${status.userGithubUsername ?? 'unknown'}`} />
    );
  }

  if (status.userConnected !== false) return undefined;

  return (
    <IntegrationItem
      provider="github"
      name="GitHub"
      description="Connect it so issues and PRs you create are authored as you."
    >
      <Button size="sm" icon={<IconChainLink3 />} onClick={() => connectUserGithub(baseUrl)}>
        Connect GitHub
      </Button>
    </IntegrationItem>
  );
}

/**
 * In an org on the Mastra Factory apps, a user writes to GitHub as themselves
 * through their own connection to the app, or through a token they paste.
 * The connection wins when both exist.
 */
function OwnGithubRow() {
  const own = useOwnGithubQuery().data;
  const connect = useConnectOwnGithubMutation();
  const removePat = useDeleteOwnGithubPatMutation();
  const [pasting, setPasting] = useState(false);
  if (!own) return undefined;

  const connection = own.connection?.status === 'active' ? own.connection : null;
  const description = connection
    ? `@${connection.accountLabel ?? 'unknown'}`
    : own.pat.configured
      ? `@${own.pat.login ?? 'unknown'} (personal access token)`
      : 'Connect it, or add a token, so issues and PRs you create are authored as you.';

  return (
    <IntegrationItem
      provider="github"
      name="GitHub"
      description={description}
      error={own.connection?.status === 'needs_reauth' ? 'Needs reauthorization' : undefined}
    >
      {!connection && (
        <Button
          size="sm"
          icon={<IconChainLink3 />}
          disabled={connect.isPending}
          onClick={() =>
            connect.mutate(undefined, { onError: error => toast.error(`Couldn't connect GitHub: ${error.message}`) })
          }
        >
          Connect GitHub
        </Button>
      )}
      {own.pat.configured ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={removePat.isPending}
          onClick={() => removePat.mutate(undefined, { onError: error => toast.error(error.message) })}
        >
          Remove token
        </Button>
      ) : (
        !connection && (
          <Button size="sm" variant="ghost" icon={<IconKey2 />} onClick={() => setPasting(true)}>
            Use a token
          </Button>
        )
      )}
      {pasting && <OwnGithubPatDialog onClose={() => setPasting(false)} />}
    </IntegrationItem>
  );
}

function OwnGithubPatDialog({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState('');
  const save = useSaveOwnGithubPatMutation();
  const submit = () =>
    save.mutate(token.trim(), {
      onSuccess: () => onClose(),
      onError: error => toast.error(error.message),
    });
  return (
    <Dialog open onOpenChange={open => !open && onClose()} pending={save.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Use a GitHub token</DialogTitle>
          <DialogDescription>
            Paste a personal access token. Factory checks it with GitHub, keeps it for you alone, and never sends it
            back to the browser.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Input
            aria-label="GitHub personal access token"
            type="password"
            placeholder="ghp_"
            value={token}
            onChange={event => setToken(event.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
          <DialogAction disabled={!token.trim()} onConfirm={submit}>
            {save.isPending ? 'Saving…' : 'Save'}
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
