import { SettingsContainer, SettingsItem, SettingsItemIcon } from '@mastra/playground-ui/new/settings';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import type { ReactNode } from 'react';
import type { IntakeConfig } from '../../factory/services/intake';

export interface IntakeSectionProps {
  config: IntakeConfig;
  listed: boolean;
}

export function toggleSourceId(ids: string[] | null, id: string): string[] | null {
  const current = ids ?? [];
  const next = current.includes(id) ? current.filter(value => value !== id) : [...current, id];
  return next.length ? next : null;
}

export function IntakeProviderCard({
  name,
  icon,
  account,
  listed,
  description,
  action,
  connection,
  syncControl,
  children,
}: {
  name: string;
  icon: ReactNode;
  account?: string;
  listed: boolean;
  description?: string;
  action?: ReactNode;
  connection?: ReactNode;
  syncControl?: ReactNode;
  children?: ReactNode;
}) {
  const connectionAction =
    (listed && syncControl) || action || connection ? (
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
        {listed && syncControl}
        {action}
        {connection}
      </div>
    ) : undefined;
  const summary = (
    <SettingsItem
      media={<SettingsItemIcon>{icon}</SettingsItemIcon>}
      title={name}
      description={
        account || description ? (
          // Metadata items wrap, so long status lines aren't cut off.
          <Metadata>
            {account && <Metadata.Item>{account}</Metadata.Item>}
            {description && <Metadata.Item>{description}</Metadata.Item>}
          </Metadata>
        ) : undefined
      }
    >
      {connectionAction}
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
