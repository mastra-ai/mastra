import { SettingsHeader } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

export function SettingsSectionHeader({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <SettingsHeader action={action} className="sm:items-end">
      {children}
    </SettingsHeader>
  );
}
