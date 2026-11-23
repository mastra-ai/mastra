import type { ComponentProps } from 'react';
import { fieldsOnSurface } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

/**
 * A settings card: a card, 14px from its edge to the content, and hairlines between rows that
 * stop at that inset. The card owns its rows' spacing: each direct child gets 13px above and below, and the card
 * adds the last 1px at its edges. Children with nothing in them (an empty `SettingsNoticeRow`) take no space and
 * draw no hairline, so a list can always render its notice row.
 */
const settingsCardStyle = cn(
  // `!`: the card owns row spacing, so a row's own reset (`Fieldset`'s `p-0`) can't remove it.
  'flex min-w-0 flex-col rounded-xl bg-card px-3.5 py-px *:py-3.25! *:empty:hidden',
  '[&>:not(:empty)~:not(:empty)]:border-t [&>:not(:empty)~:not(:empty)]:border-separator',
  'shadow-raised',
  fieldsOnSurface,
  // A dialog is a card already, so here it is a box inside one. An `in-*` variant adds no specificity, so it would tie
  // with the `bg-card` an app compiles after these styles.
  '[:is([role=dialog],[role=alertdialog])_&]:bg-nested [:is([role=dialog],[role=alertdialog])_&]:shadow-none',
  '[:is([role=dialog],[role=alertdialog])_&]:[--field:var(--field-on-nested)]',
);

export type SettingsContainerProps = ComponentProps<'div'>;

/** One settings card. Holds `SettingsRow`s, `SettingsItem`s, a `SettingsListHeader` or a `SettingsEmptyRow`. */
export function SettingsContainer({ className, ...props }: SettingsContainerProps) {
  return <div data-slot="settings-container" className={cn(settingsCardStyle, className)} {...props} />;
}
