import { DayPickerContextValue } from 'contexts/DayPicker';
import { ActiveModifiers, InternalModifier } from 'types/Modifiers';

function isInternalModifier(modifier: string): modifier is InternalModifier {
  return Object.values(InternalModifier).includes(modifier as InternalModifier);
}

/**
 * Return the class names for the Day element, according to the given active
 * modifiers.
 *
 * Custom class names are set via `modifiersClassNames` or `classNames`,
 * where the first have the precedence.
 */
export function getDayClassNames(
  dayPicker: Pick<DayPickerContextValue, 'modifiersClassNames' | 'classNames'>,
  activeModifiers: ActiveModifiers
) {
  const classNames: string[] = [dayPicker.classNames.day];
  Object.keys(activeModifiers).forEach((modifier) => {
    const customClassName = dayPicker.modifiersClassNames[modifier];
    if (customClassName) {
      classNames.push(customClassName);
    } else if (isInternalModifier(modifier)) {
      const internalClassName = dayPicker.classNames[`day_${modifier}`];
      if (internalClassName) {
        classNames.push(internalClassName);
      }
    }
  });
  return classNames;
}
