import { DayPickerContextValue } from 'contexts/DayPicker';
import { SelectMultipleContextValue } from 'contexts/SelectMultiple';
import { SelectRangeContextValue } from 'contexts/SelectRange';
import { isDayPickerMultiple } from 'types/DayPickerMultiple';
import { isDayPickerRange } from 'types/DayPickerRange';
import { InternalModifier, InternalModifiers } from 'types/Modifiers';

import { matcherToArray } from './matcherToArray';

const {
  Selected,
  Disabled,
  Hidden,
  Today,
  RangeEnd,
  RangeMiddle,
  RangeStart,
  Outside
} = InternalModifier;

/** Return the {@link InternalModifiers} from the DayPicker and select contexts. */
export function getInternalModifiers(
  dayPicker: DayPickerContextValue,
  selectMultiple: SelectMultipleContextValue,
  selectRange: SelectRangeContextValue
) {
  const internalModifiers: InternalModifiers = {
    [Selected]: matcherToArray(dayPicker.selected),
    [Disabled]: matcherToArray(dayPicker.disabled),
    [Hidden]: matcherToArray(dayPicker.hidden),
    [Today]: [dayPicker.today],
    [RangeEnd]: [],
    [RangeMiddle]: [],
    [RangeStart]: [],
    [Outside]: []
  };

  if (dayPicker.fromDate) {
    internalModifiers[Disabled].push({ before: dayPicker.fromDate });
  }
  if (dayPicker.toDate) {
    internalModifiers[Disabled].push({ after: dayPicker.toDate });
  }

  if (isDayPickerMultiple(dayPicker)) {
    internalModifiers[Disabled] = internalModifiers[Disabled].concat(
      selectMultiple.modifiers[Disabled]
    );
  } else if (isDayPickerRange(dayPicker)) {
    internalModifiers[Disabled] = internalModifiers[Disabled].concat(
      selectRange.modifiers[Disabled]
    );
    internalModifiers[RangeStart] = selectRange.modifiers[RangeStart];
    internalModifiers[RangeMiddle] = selectRange.modifiers[RangeMiddle];
    internalModifiers[RangeEnd] = selectRange.modifiers[RangeEnd];
  }
  return internalModifiers;
}
