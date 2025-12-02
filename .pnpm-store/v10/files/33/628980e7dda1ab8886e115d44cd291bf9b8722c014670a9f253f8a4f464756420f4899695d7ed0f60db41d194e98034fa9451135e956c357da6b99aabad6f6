import { getActiveModifiers, useModifiers } from 'contexts/Modifiers';
import { ActiveModifiers } from 'types/Modifiers';

/**
 * Return the active modifiers for the specified day.
 *
 * This hook is meant to be used inside internal or custom components.
 *
 * @param day
 * @param displayMonth
 */
export function useActiveModifiers(
  day: Date,
  /**
   * The month where the date is displayed. If not the same as `date`, the day
   * is an "outside day".
   */
  displayMonth?: Date
): ActiveModifiers {
  const modifiers = useModifiers();
  const activeModifiers = getActiveModifiers(day, modifiers, displayMonth);
  return activeModifiers;
}
