import { addMonths } from 'date-fns';

import { renderDayPickerHook } from 'test/render';

import { ActiveModifiers } from 'types/Modifiers';

import { useActiveModifiers } from './useActiveModifiers';

const date = new Date(2010, 5, 23);

describe('when in the same month', () => {
  const displayMonth = date;
  test('should return the active modifiers', () => {
    const result = renderDayPickerHook<ActiveModifiers>(() =>
      useActiveModifiers(date, displayMonth)
    );
    expect(result).toBeDefined();
  });
});

describe('when not in the same display month', () => {
  const displayMonth = addMonths(date, 1);
  test('should return the outside modifier', () => {
    const result = renderDayPickerHook<ActiveModifiers>(() =>
      useActiveModifiers(date, displayMonth)
    );
    expect(result.current.outside).toBe(true);
  });
});
