import { isSameMonth } from 'date-fns';

import { ActiveModifiers, Modifiers } from 'types/Modifiers';

import { isMatch } from './isMatch';

/** Return the active modifiers for the given day. */
export function getActiveModifiers(
  day: Date,
  /** The modifiers to match for the given date. */
  modifiers: Modifiers,
  /** The month where the day is displayed, to add the "outside" modifiers.  */
  displayMonth?: Date
): ActiveModifiers {
  const matchedModifiers = Object.keys(modifiers).reduce(
    (result: string[], key: string): string[] => {
      const modifier = modifiers[key];
      if (isMatch(day, modifier)) {
        result.push(key);
      }
      return result;
    },
    []
  );
  const activeModifiers: ActiveModifiers = {};
  matchedModifiers.forEach((modifier) => (activeModifiers[modifier] = true));

  if (displayMonth && !isSameMonth(day, displayMonth)) {
    activeModifiers.outside = true;
  }

  return activeModifiers;
}
