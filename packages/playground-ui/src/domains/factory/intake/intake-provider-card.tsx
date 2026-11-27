import type { ReactNode } from 'react';
import type { IntakeConfig } from './intake-types';
import { Metadata } from '@/ds/components/Metadata';
import { SettingsContainer, SettingsItem, SettingsItemIcon } from '@/ds/new/settings';

export interface IntakeSectionProps {
  config: IntakeConfig;
  listed: boolean;
}

export function IntakeProviderCard({
  name,
  icon,
  account,
  listed,
  description,
  action,
  connection,
  children,
}: {
  name: string;
  icon: ReactNode;
  account?: string;
  listed: boolean;
  description?: string;
  action?: ReactNode;
  connection?: ReactNode;
  children?: ReactNode;
}) {
  const hasActions = Boolean(action || connection);
  const hasDetails = Boolean(account || description);
  const summary = (
    <SettingsItem
      media={<SettingsItemIcon>{icon}</SettingsItemIcon>}
      title={name}
      description={hasDetails ? <IntakeProviderDetails account={account} description={description} /> : undefined}
    >
      {hasActions ? <IntakeProviderActions action={action} connection={connection} /> : undefined}
    </SettingsItem>
  );
  if (!listed) return summary;
  return (
    <SettingsContainer role="region" aria-label={name}>
      {summary}
      {children}
    </SettingsContainer>
  );
}

function IntakeProviderDetails({ account, description }: { account?: string; description?: string }) {
  return (
    // Metadata items wrap, so long status lines aren't cut off.
    <Metadata>
      {account && <Metadata.Item>{account}</Metadata.Item>}
      {description && <Metadata.Item>{description}</Metadata.Item>}
    </Metadata>
  );
}

function IntakeProviderActions({ action, connection }: { action?: ReactNode; connection?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
      {action}
      {connection}
    </div>
  );
}
