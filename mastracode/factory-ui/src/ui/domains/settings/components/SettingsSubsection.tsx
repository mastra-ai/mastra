import { SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode, Ref } from 'react';
import { ScopeBadge } from './SettingsScope';
import type { SettingsScope } from './SettingsScope';

/**
 * One section of a settings page: its title (with the description in a tooltip) above its card. A list's action
 * goes in its card (`SettingsListHeader`), so `action` is only for controls that change the whole section.
 */
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
  const heading = (
    <SettingsTitle info={description || undefined} accessory={scope && <ScopeBadge scope={scope} />}>
      {title}
    </SettingsTitle>
  );

  return (
    <SettingsGroup ref={ref} id={id}>
      {action ? <SettingsHeader action={action}>{heading}</SettingsHeader> : heading}
      {children}
    </SettingsGroup>
  );
}
