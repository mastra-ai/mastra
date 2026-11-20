import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { PINNED, SETTINGS_COLUMN } from '../settingsColumn';

/** A settings block. On the Overview it is pinned so it stays in view while the map scrolls sideways. */
export function SettingsColumn({
  pinned,
  sticky,
  className,
  children,
}: {
  pinned?: boolean;
  sticky?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const stuck = sticky && 'sticky bottom-4 z-10';
  if (!pinned) return <div className={cn(SETTINGS_COLUMN, stuck, className)}>{children}</div>;
  return (
    <div className={cn(PINNED, stuck)}>
      <div className={cn(SETTINGS_COLUMN, className)}>{children}</div>
    </div>
  );
}
