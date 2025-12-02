import { Modifiers } from 'types/Modifiers';

import { getInitialFocusTarget } from './getInitialFocusTarget';

describe('when no days are selected is selected', () => {
  test('should return the first day of month', () => {
    const displayMonth = new Date(2022, 7);
    const modifiers: Modifiers = {
      outside: [],
      disabled: [],
      selected: [],
      hidden: [],
      today: [],
      range_start: [],
      range_end: [],
      range_middle: []
    };
    const initialFocusTarget = getInitialFocusTarget([displayMonth], modifiers);
    expect(initialFocusTarget).toStrictEqual(displayMonth);
  });
});

describe('when a day is selected', () => {
  test('should return the selected day', () => {
    const displayMonths = [new Date(2022, 7)];
    const selectedDay1 = new Date(2022, 7, 17);
    const selectedDay2 = new Date(2022, 7, 19);
    const modifiers: Modifiers = {
      outside: [],
      disabled: [],
      selected: [selectedDay1, selectedDay2],
      hidden: [],
      today: [],
      range_start: [],
      range_end: [],
      range_middle: []
    };
    const initialFocusTarget = getInitialFocusTarget(displayMonths, modifiers);
    expect(initialFocusTarget).toStrictEqual(selectedDay1);
  });
});
