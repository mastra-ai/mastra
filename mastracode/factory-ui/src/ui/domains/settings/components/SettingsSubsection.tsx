import { SettingsDescription, SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode, Ref } from 'react';
import { ScopeBadge } from './SettingsScope';
import type { SettingsScope } from './SettingsScope';
import { SettingsSectionHeader } from './common/SettingsSectionHeader';

export function SettingsSubsection({
  ref,
  id,
  title,
  description,
  scope,
  action,
  children,
}: {
  ref?: Ref<HTMLElement>;
  id?: string;
  title: string;
  description?: string;
  scope?: SettingsScope;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SettingsGroup ref={ref} id={id}>
      <SettingsSectionHeader action={action}>
        <SettingsTitle accessory={scope && <ScopeBadge scope={scope} />}>{title}</SettingsTitle>
        {description && <SettingsDescription>{description}</SettingsDescription>}
      </SettingsSectionHeader>
      {children}
    </SettingsGroup>
  );
}
