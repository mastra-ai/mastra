import { SettingsDescription, SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';
import { ScopeBadge } from './SettingsScope';
import type { SettingsScope } from './SettingsScope';

export function SettingsSubsection({
  id,
  title,
  description,
  scope,
  action,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  scope?: SettingsScope;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SettingsGroup id={id}>
      <SettingsHeader action={action}>
        <SettingsTitle accessory={scope && <ScopeBadge scope={scope} />}>{title}</SettingsTitle>
        {description && <SettingsDescription>{description}</SettingsDescription>}
      </SettingsHeader>
      {children}
    </SettingsGroup>
  );
}
