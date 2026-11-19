import { SettingsContainer, SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import type { ReactNode } from 'react';
import type { IntakeConfig, IntakeSelection } from '../../factory/services/intake';

export interface IntakeSectionProps {
  config: IntakeConfig;
  listed: boolean;
}

export function toggleSourceId(ids: string[] | null, id: string): string[] | null {
  const current = ids ?? [];
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  return next.length ? next : null;
}

/** A provider syncs exactly the sources picked; `enabled` follows so older servers agree. */
export function withSourceIds(selection: IntakeSelection, sourceIds: string[] | null): IntakeSelection {
  const picked = sourceIds?.length ? sourceIds : null;
  return { ...selection, sourceIds: picked, enabled: picked !== null };
}

export function toggleSource(selection: IntakeSelection, id: string): IntakeSelection {
  return withSourceIds(selection, toggleSourceId(selection.sourceIds, id));
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
