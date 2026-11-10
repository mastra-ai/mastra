import type { ReactNode } from 'react';
import { Kbd } from '@/ds/components/Kbd';

export type SidebarButtonHintProps = {
  label: ReactNode;
  shortcut?: ReactNode;
};

/** Tooltip content for the sidebar's header buttons: the label, then its shortcut. */
export function SidebarButtonHint({ label, shortcut }: SidebarButtonHintProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {shortcut ? (
        <Kbd size="xs" className="bg-muted text-muted-foreground">
          {shortcut}
        </Kbd>
      ) : null}
    </span>
  );
}
