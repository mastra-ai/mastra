import { DayPickerProps } from 'DayPicker';

import { DayPickerContextValue } from 'contexts/DayPicker';

import { DayPickerBase } from './DayPickerBase';
import { SelectMultipleEventHandler } from './EventHandlers';

/** The props for the {@link DayPicker} component when using `mode="multiple"`. */
export interface DayPickerMultipleProps extends DayPickerBase {
  mode: 'multiple';
  /** The selected days. */
  selected?: Date[] | undefined;
  /** Event fired when a days added or removed to the selection. */
  onSelect?: SelectMultipleEventHandler;
  /** The minimum amount of days that can be selected. */
  min?: number;
  /** The maximum amount of days that can be selected. */
  max?: number;
}

/** Returns true when the props are of type {@link DayPickerMultipleProps}. */
export function isDayPickerMultiple(
  props: DayPickerProps | DayPickerContextValue
): props is DayPickerMultipleProps {
  return props.mode === 'multiple';
}
