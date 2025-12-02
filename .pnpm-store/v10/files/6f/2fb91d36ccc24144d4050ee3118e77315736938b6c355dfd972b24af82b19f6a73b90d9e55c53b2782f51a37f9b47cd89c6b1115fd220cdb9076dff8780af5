import { Locale } from 'date-fns';

import { ActiveModifiers } from 'types/Modifiers';

/** Map of functions to translate ARIA labels for the relative elements. */
export type Labels = {
  labelMonthDropdown: () => string;
  labelYearDropdown: () => string;
  labelNext: NavButtonLabel;
  labelPrevious: NavButtonLabel;
  /** @deprecated This label is not used anymore and this function will be removed in the future. */
  labelDay: DayLabel;
  labelWeekday: WeekdayLabel;
  labelWeekNumber: WeekNumberLabel;
};

/** Return the ARIA label for the {@link Day} component. */
export type DayLabel = (
  day: Date,
  activeModifiers: ActiveModifiers,
  options?: {
    locale?: Locale;
  }
) => string;

/** Return the ARIA label for the "next month" / "prev month" buttons in the navigation.*/
export type NavButtonLabel = (
  month?: Date,
  options?: {
    locale?: Locale;
  }
) => string;

/** Return the ARIA label for the Head component.*/
export type WeekdayLabel = (
  day: Date,
  options?: {
    locale?: Locale;
  }
) => string;

/** Return the ARIA label of the week number.*/
export type WeekNumberLabel = (
  n: number,
  options?: {
    locale?: Locale;
  }
) => string;
