import { SettingsHeader } from '@mastra/playground-ui/new/settings';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export function SettingsSectionHeader({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <SettingsHeader
      action={action}
      className={cn('sm:flex-wrap sm:items-end', action != null && 'sm:[&>div:last-child]:ml-auto')}
    >
      {children}
    </SettingsHeader>
  );
}
