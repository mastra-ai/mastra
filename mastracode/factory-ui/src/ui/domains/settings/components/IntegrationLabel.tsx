import type { ComponentProps } from 'react';

import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';

export function IntegrationLabel({
  provider,
  name,
}: {
  provider: ComponentProps<typeof SettingsIntegrationIcon>['provider'];
  name: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <SettingsIntegrationIcon provider={provider} />
      {name}
    </span>
  );
}
