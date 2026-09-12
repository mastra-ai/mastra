import { SettingsDescription, SettingsGroup, SettingsHeader, SettingsTitle } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';
import { ScopeBadge, ScopeSwitch } from './SettingsScope';
import type { ScopeControl, SettingsScope } from './SettingsScope';

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
  scope: SettingsScope | ScopeControl;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SettingsGroup id={id}>
      <SettingsHeader action={action}>
        <SettingsTitle accessory={<ScopeIndicator scope={scope} />}>{title}</SettingsTitle>
        {description && <SettingsDescription>{description}</SettingsDescription>}
      </SettingsHeader>
      {children}
    </SettingsGroup>
  );
}

function ScopeIndicator({ scope }: { scope: SettingsScope | ScopeControl }) {
  if (typeof scope === 'string') return <ScopeBadge scope={scope} />;
  if (scope.options.length > 1) return <ScopeSwitch {...scope} />;
  return <ScopeBadge scope={scope.value} />;
}
