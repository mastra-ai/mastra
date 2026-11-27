import type { ReactNode } from 'react';

import { Button } from '@/ds/components/Button';
import { IconSidebarSimpleRightWide } from '@/ds/icons/central/IconSidebarSimpleRightWide';

/** The session panel's frame: its subject row on top, the body below. */
export function PanelFrame({ subject, children }: { subject: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden">
      <div className="flex shrink-0 py-1.5 ps-1.5 pe-[calc(0.375rem+var(--dock-actions-reserve,0px))]">{subject}</div>
      {children}
    </div>
  );
}

/** Shows or hides a docked session panel. */
export function SessionPanelToggle({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Button
      size="icon-sm"
      variant={open ? 'default' : 'ghost'}
      tooltip={open ? 'Hide session panel' : 'Show session panel'}
      aria-label="Session panel"
      aria-pressed={open}
      onClick={() => onOpenChange(!open)}
    >
      <IconSidebarSimpleRightWide />
    </Button>
  );
}
