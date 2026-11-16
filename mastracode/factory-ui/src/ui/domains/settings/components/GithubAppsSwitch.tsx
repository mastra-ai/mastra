import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useGithubSwitchQuery, useSwitchGithubAppsMutation } from '../../../../hooks/useGithubApps';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { PLATFORM_CONNECT_PROVIDERS } from '../../factory/services/platformConnect';
import { GithubAppsRequestError } from '../../workspaces/services/githubApps';
import type { FactoryGithubApp, GithubSwitchMissing, GithubSwitchStatus } from '../../workspaces/services/githubApps';
import { IntegrationItem } from './IntegrationItem';
import { PlatformConnectButton, PlatformReconnectButton } from './PlatformProviderConnections';
import { IconArrowRightLeft } from '@mastra/playground-ui/icons/central/IconArrowRightLeft';

const APPS: FactoryGithubApp[] = ['factory-github', 'factory-reviews-github'];

function appName(app: FactoryGithubApp): string {
  return PLATFORM_CONNECT_PROVIDERS[app].displayName;
}

function appNames(apps: FactoryGithubApp[]): string {
  return apps.map(appName).join(' and ');
}

/** What still blocks the switch, one line each. */
export function describeMissing(missing: GithubSwitchMissing): string[] {
  return [
    ...missing.unreadable.map(({ app, message }) => `Couldn't read the ${appName(app)}: ${message}`),
    ...missing.accounts.map(({ accountLogin, apps }) => `Install the ${appNames(apps)} on ${accountLogin}`),
    ...missing.repositories.map(({ slug, apps }) => `Give the ${appNames(apps)} access to ${slug}`),
  ];
}

/**
 * Moves an org from the legacy GitHub App to the Mastra Factory apps: install
 * both apps, check every linked repository is reachable, then switch. Shown
 * only to org admins, and only until the org has switched. Servers without
 * the switch don't report a mode, so nothing is asked of them.
 */
export function GithubAppsSwitchRows() {
  const legacy = useGithubStatusQuery().data?.mode === 'legacy';
  const query = useGithubSwitchQuery(legacy);
  const status = query.data;
  if (!status || status.mode !== 'legacy') return null;
  return (
    <>
      {APPS.map(app => (
        <GithubAppRow key={app} app={app} status={status} />
      ))}
      <SwitchRow status={status} />
    </>
  );
}

function GithubAppRow({ app, status }: { app: FactoryGithubApp; status: GithubSwitchStatus }) {
  const connections = status.connections.filter(connection => connection.app === app);
  const expired = connections.find(connection => connection.status === 'needs_reauth');
  const accounts = connections
    .filter(connection => connection.status === 'active')
    .map(connection => connection.accountLogin ?? 'Installed');
  return (
    <IntegrationItem
      provider="github"
      name={appName(app)}
      description={accounts.length > 0 ? accounts.join(', ') : 'Not installed'}
      error={expired ? 'Needs reauthorization' : undefined}
    >
      {expired ? <PlatformReconnectButton provider={app} connectionId={expired.id} /> : null}
      <PlatformConnectButton provider={app} />
    </IntegrationItem>
  );
}

function SwitchRow({ status }: { status: GithubSwitchStatus }) {
  const [confirming, setConfirming] = useState(false);
  const switchApps = useSwitchGithubAppsMutation();
  const plan = status.plan;
  const blockers = plan ? describeMissing(plan.missing) : [];
  const missingApps = plan?.missing.apps ?? [];
  const ready = plan?.ready === true;

  const description = ready ? (
    'Both apps reach every repository linked to a project.'
  ) : missingApps.length > 0 ? (
    `Install the ${appNames(missingApps)} first.`
  ) : blockers.length > 0 ? (
    <ul aria-label="Before you can switch" className="list-disc pl-4">
      {blockers.map(blocker => (
        <li key={blocker}>{blocker}</li>
      ))}
    </ul>
  ) : (
    'Checking…'
  );

  const confirm = () => {
    switchApps.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        toast.success('GitHub now runs on the Mastra Factory apps');
      },
      onError: error => {
        setConfirming(false);
        toast.error(
          error instanceof GithubAppsRequestError && error.status === 409
            ? "Couldn't switch yet. Check what's still missing."
            : error.message,
        );
      },
    });
  };

  return (
    <IntegrationItem provider="github" name="Switch to the Mastra Factory apps" description={description}>
      <Button size="sm" icon={<IconArrowRightLeft />} disabled={!ready} onClick={() => setConfirming(true)}>
        Switch
      </Button>
      {confirming && (
        <Dialog open onOpenChange={open => !open && setConfirming(false)} pending={switchApps.isPending}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Switch GitHub to the Mastra Factory apps?</DialogTitle>
              <DialogDescription>
                Factory will read and write GitHub through the Mastra Factory apps for every project in this
                organization. Linked repositories, cards and pull requests carry over. You can't switch back from here.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction onConfirm={confirm}>{switchApps.isPending ? 'Switching…' : 'Switch'}</DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </IntegrationItem>
  );
}
