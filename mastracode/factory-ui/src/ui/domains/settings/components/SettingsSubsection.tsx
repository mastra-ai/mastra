import { SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';
import { ScopeBadge } from './SettingsScope';
import type { SettingsScope } from './SettingsScope';
import { SettingsSectionHeader } from './common/SettingsSectionHeader';

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
  /** What the section is for, shown in a tooltip on its title. */
  description?: string;
  scope?: SettingsScope;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SettingsGroup id={id}>
      <SettingsSectionHeader action={action}>
        <SettingsTitle accessory={scope && <ScopeBadge scope={scope} />} info={description}>
          {title}
        </SettingsTitle>
      </SettingsSectionHeader>
      {children}
    </SettingsGroup>
  );
}
