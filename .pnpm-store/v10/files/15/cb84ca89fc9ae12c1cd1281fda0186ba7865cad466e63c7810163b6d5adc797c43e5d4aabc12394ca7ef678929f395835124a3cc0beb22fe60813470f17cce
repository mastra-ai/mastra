import { CSSProperties } from 'react';

import { Matcher } from './Matchers';

/** A _modifier_ represents different styles or states of a day displayed in the calendar. */
export type Modifier = string;

/** The modifiers used by DayPicker. */
export type Modifiers = CustomModifiers & InternalModifiers;

/** The name of the modifiers that are used internally by DayPicker. */
export enum InternalModifier {
  Outside = 'outside',
  /** Name of the modifier applied to the disabled days, using the `disabled` prop. */
  Disabled = 'disabled',
  /** Name of the modifier applied to the selected days using the `selected` prop). */
  Selected = 'selected',
  /** Name of the modifier applied to the hidden days using the `hidden` prop). */
  Hidden = 'hidden',
  /** Name of the modifier applied to the day specified using the `today` prop). */
  Today = 'today',
  /** The modifier applied to the day starting a selected range, when in range selection mode.  */
  RangeStart = 'range_start',
  /** The modifier applied to the day ending a selected range, when in range selection mode.  */
  RangeEnd = 'range_end',
  /** The modifier applied to the days between the start and the end of a selected range, when in range selection mode.  */
  RangeMiddle = 'range_middle'
}

/** Map of matchers used for the internal modifiers. */
export type InternalModifiers = Record<InternalModifier, Matcher[]>;

/**
 * The modifiers that are matching a day in the calendar. Use the {@link useActiveModifiers} hook to get the modifiers for a day.
 *
 * ```
 * const activeModifiers: ActiveModifiers = {
 *  selected: true,
 *  customModifier: true
 * }
 * ```
 *
 * */
export type ActiveModifiers = Record<Modifier, true> &
  Partial<Record<InternalModifier, true>>;

/** The style to apply to each day element matching a modifier. */
export type ModifiersStyles = Record<Modifier, CSSProperties> &
  Partial<Record<InternalModifier, CSSProperties>>;

/** The classnames to assign to each day element matching a modifier. */
export type ModifiersClassNames = Record<Modifier, string> &
  Partial<Record<InternalModifier, string>>;

/** The custom modifiers passed to the {@link DayPickerBase.modifiers}. */
export type DayModifiers = Record<Modifier, Matcher | Matcher[]>;

/**
 * A map of matchers used as custom modifiers by DayPicker component. This is
 * the same as {@link DayModifiers]], but it accepts only array of [[Matcher}s.
 */
export type CustomModifiers = Record<Modifier, Matcher[]>;
