import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Link2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { IntakeConfig } from '../../factory/services/intake';
import { settingsSectionPath } from '../settingsSections';
import { ConnectionManagementButton } from './common/ConnectionManagementButton';
import { SettingsSectionHeader } from './common/SettingsSectionHeader';

export interface IntakeSectionProps {
  config: IntakeConfig;
  busy: boolean;
  update: (next: IntakeConfig) => Promise<void>;
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
  connectable = true,
  description,
  action,
  syncControl,
  children,
}: {
  name: string;
  icon: ReactNode;
  account?: string;
  listed: boolean;
  connectable?: boolean;
  description?: string;
  action?: ReactNode;
  syncControl?: ReactNode;
  children?: ReactNode;
}) {
  const { factoryId } = useParams<{ factoryId: string }>();
  const connectionsPath = factoryId ? settingsSectionPath(factoryId, 'connections') : undefined;
  const showConnectionAction = listed || connectable;
  const connectionAction = (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:w-auto">
      {listed && syncControl}
      {action}
      {connectionsPath &&
        showConnectionAction &&
        (listed ? (
          <ConnectionManagementButton render={<Link to={connectionsPath} />}>
            Manage connection
          </ConnectionManagementButton>
        ) : (
          <Button size="sm" icon={<Link2 />} render={<Link to={`${connectionsPath}?add=1`} />}>
            Connect {name}
          </Button>
        ))}
    </div>
  );
  if (!listed) {
    return (
      <SettingsRow
        label={
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="size-4 shrink-0" aria-hidden>
              {icon}
            </span>
            <span>{name}</span>
            {account && (
              <Txt as="span" variant="caption" tone="muted">
                {account}
              </Txt>
            )}
          </span>
        }
        description={description}
      >
        {connectionAction}
      </SettingsRow>
    );
  }
  return (
    <section aria-label={name} className="flex min-w-0 flex-col gap-3">
      <SettingsSectionHeader action={connectionAction}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-4 shrink-0" aria-hidden>
              {icon}
            </span>
            <Txt as="span" variant="label">
              {name}
            </Txt>
          </span>
          {account && (
            <Txt variant="caption" tone="muted" className="wrap-anywhere">
              {account}
            </Txt>
          )}
          {description && (
            <Txt variant="caption" tone="muted">
              {description}
            </Txt>
          )}
        </div>
      </SettingsSectionHeader>
      {children && <SettingsContainer>{children}</SettingsContainer>}
    </section>
  );
}
