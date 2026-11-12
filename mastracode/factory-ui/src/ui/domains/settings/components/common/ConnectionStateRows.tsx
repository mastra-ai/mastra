import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { RotateCcw } from 'lucide-react';

import { IntegrationItem } from '../IntegrationItem';
import type { IntegrationProvider } from '../IntegrationItem';

export function accessDescription(reason: string | undefined, name: string): string | undefined {
  if (reason === 'auth_required') return 'Sign in to manage organization connections.';
  if (reason === 'organization_required') return `Select an organization to connect ${name}.`;
  return undefined;
}

/** A row that failed to load, with a Retry button. With a `provider`, it's that integration's list item. */
export function RetryRow({
  label,
  provider,
  errorMsg,
  onRetry,
}: {
  label: string;
  provider?: IntegrationProvider;
  errorMsg: string;
  onRetry: () => void;
}) {
  const retry = (
    <Button size="sm" icon={<RotateCcw />} onClick={onRetry}>
      Retry
    </Button>
  );
  if (provider) {
    return (
      <IntegrationItem provider={provider} name={label} error={errorMsg}>
        {retry}
      </IntegrationItem>
    );
  }
  return (
    <SettingsRow label={label} errorMsg={errorMsg}>
      {retry}
    </SettingsRow>
  );
}

export function NotConfiguredRow({ provider, name }: { provider: IntegrationProvider; name: string }) {
  return <IntegrationItem provider={provider} name={name} description="Not configured on this server." />;
}
