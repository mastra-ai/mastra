import type { ComponentProps } from 'react';
import { fieldsOnSurface } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

/**
 * A settings card: the card fill with no rim, 14px padding on every side, and hairlines between rows that stop
 * at that padding. The card owns its rows' spacing (13px above and below each one, none at its edges), so rows
 * and custom row content carry no padding of their own.
 */
const settingsCardStyle = cn(
  'flex min-w-0 flex-col divide-y divide-border rounded-xl bg-card p-3.5 *:py-3.25 *:first:pt-0 *:last:pb-0',
  fieldsOnSurface,
);

export type SettingsContainerProps = ComponentProps<'div'>;

/** One settings card. Holds `SettingsRow`s, `SettingsItem`s, a `SettingsListHeader` or a `SettingsEmptyRow`. */
export function SettingsContainer({ className, ...props }: SettingsContainerProps) {
  return <div data-slot="settings-container" className={cn(settingsCardStyle, className)} {...props} />;
}
