import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

export function accessDescription(reason: string | undefined, name: string): string | undefined {
  if (reason === 'auth_required') return 'Sign in to manage organization connections.';
  if (reason === 'organization_required') return `Select an organization to connect ${name}.`;
  return undefined;
}

export function RetryRow({ label, errorMsg, onRetry }: { label: ReactNode; errorMsg: string; onRetry: () => void }) {
  return (
    <SettingsRow label={label} errorMsg={errorMsg}>
      <Button size="sm" icon={<RotateCcw />} onClick={onRetry}>
        Retry
      </Button>
    </SettingsRow>
  );
}

export function NotConfiguredRow({ label }: { label: ReactNode }) {
  return <SettingsRow label={label} description="Not configured on this server." />;
}
