import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SettingsValueProps = {
  children: ReactNode;
  /** Monospace with even digits, for machine values people read but don't copy, like versions. */
  mono?: boolean;
  className?: string;
};

/**
 * A value people read but don't change or copy, in a `SettingsRow`'s control slot: a name, an email, a sign-in
 * method, a status. Plain muted text on one line, cut at the end with the whole value on hover.
 *
 * Which piece shows a setting's value:
 * - The person can change it here: the control itself (`Input`, `Select`, `Switch`).
 * - It's a setting they can't change (no permission, managed elsewhere): `SettingsRow viewOnly`.
 * - They'll paste it somewhere else (an ID, key, URL, connection string): `CopyField`.
 * - Otherwise it's information to read: `SettingsValue`.
 */
export function SettingsValue({ children, mono = false, className }: SettingsValueProps) {
  return (
    <span
      data-slot="settings-value"
      title={typeof children === 'string' ? children : undefined}
      className={cn('min-w-0 truncate text-body-sm text-muted-foreground', mono && 'font-mono tabular-nums', className)}
    >
      {children}
    </span>
  );
}
