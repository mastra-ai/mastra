import type { ReactNode } from 'react';
import { Kbd } from './kbd';

export type ShortcutHintProps = {
  label: ReactNode;
  shortcut?: ReactNode;
};

export function ShortcutHint({ label, shortcut }: ShortcutHintProps) {
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
