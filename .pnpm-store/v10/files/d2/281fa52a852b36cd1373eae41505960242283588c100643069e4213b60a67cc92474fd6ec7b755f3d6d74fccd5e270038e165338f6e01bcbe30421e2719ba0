import { CustomModifiers, DayModifiers } from 'types/Modifiers';

import { matcherToArray } from './matcherToArray';

/** Create CustomModifiers from dayModifiers */
export function getCustomModifiers(
  dayModifiers: DayModifiers
): CustomModifiers {
  const customModifiers: CustomModifiers = {};
  Object.entries(dayModifiers).forEach(([modifier, matcher]) => {
    customModifiers[modifier] = matcherToArray(matcher);
  });
  return customModifiers;
}
