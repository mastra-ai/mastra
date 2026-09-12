import { SettingsSubsection as SharedSettingsSubsection } from '@mastra/playground-ui/components/SettingsSubsection';
import type { ComponentProps } from 'react';

import { ScopeBadge, ScopeSwitch } from './SettingsScope';
import type { ScopeControl, SettingsScope } from './SettingsScope';

export function SettingsSubsection({
  scope,
  ...props
}: Omit<ComponentProps<typeof SharedSettingsSubsection>, 'titleAccessory'> & {
  scope: SettingsScope | ScopeControl;
}) {
  return <SharedSettingsSubsection {...props} titleAccessory={<ScopeIndicator scope={scope} />} />;
}

function ScopeIndicator({ scope }: { scope: SettingsScope | ScopeControl }) {
  if (typeof scope === 'string') return <ScopeBadge scope={scope} />;
  if (scope.options.length > 1) return <ScopeSwitch {...scope} />;
  return <ScopeBadge scope={scope.value} />;
}
