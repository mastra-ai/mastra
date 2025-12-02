/* eslint-disable jest/no-standalone-expect */
import { addDays, format, parseISO } from 'date-fns';

import {
  InternalModifier,
  InternalModifiers,
  Modifiers
} from 'types/Modifiers';

import {
  FocusDayPickerContext,
  getNextFocus,
  MoveFocusBy,
  MoveFocusDirection
} from './getNextFocus';

type test = {
  focusedDay: string;
  moveBy: MoveFocusBy;
  direction: MoveFocusDirection;
  context: FocusDayPickerContext;
  expectedNextFocus: string;
};

const tests: test[] = [
  {
    focusedDay: '2022-08-17',
    moveBy: 'day',
    direction: 'after',
    context: {},
    expectedNextFocus: '2022-08-18'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'day',
    direction: 'before',
    context: {},
    expectedNextFocus: '2022-08-16'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'week',
    direction: 'after',
    context: {},
    expectedNextFocus: '2022-08-24'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'week',
    direction: 'before',
    context: {},
    expectedNextFocus: '2022-08-10'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'month',
    direction: 'after',
    context: {},
    expectedNextFocus: '2022-09-17'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'startOfWeek',
    direction: 'before',
    context: {
      weekStartsOn: 1
    },
    expectedNextFocus: '2022-08-15'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'endOfWeek',
    direction: 'before',
    context: {
      weekStartsOn: 1
    },
    expectedNextFocus: '2022-08-21'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'month',
    direction: 'after',
    context: {},
    expectedNextFocus: '2022-09-17'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'year',
    direction: 'before',
    context: {},
    expectedNextFocus: '2021-08-17'
  },
  {
    focusedDay: '2022-08-17',
    moveBy: 'year',
    direction: 'after',
    context: {},
    expectedNextFocus: '2023-08-17'
  }
];

describe.each(tests)(
  'when focusing the $moveBy $direction $focusedDay',
  ({ focusedDay, moveBy, direction, context, expectedNextFocus }) => {
    test(`should return ${expectedNextFocus}`, () => {
      const nextFocus = getNextFocus(parseISO(focusedDay), {
        moveBy,
        direction,
        context
      });
      expect(format(nextFocus, 'yyyy-MM-dd')).toBe(expectedNextFocus);
    });
  }
);

describe('when reaching the "fromDate"', () => {
  const focusedDay = new Date();
  const fromDate = addDays(focusedDay, -1);
  test('next focus should be "fromDate"', () => {
    const nextFocus = getNextFocus(focusedDay, {
      moveBy: 'day',
      direction: 'before',
      context: { fromDate }
    });
    expect(nextFocus).toStrictEqual(fromDate);
  });
});

describe('when reaching the "toDate"', () => {
  const focusedDay = new Date();
  const toDate = addDays(focusedDay, 1);
  test('next focus should be "toDate"', () => {
    const nextFocus = getNextFocus(focusedDay, {
      moveBy: 'day',
      direction: 'after',
      context: { toDate }
    });
    expect(nextFocus).toStrictEqual(toDate);
  });
});

const emptyModifiers: Modifiers = {
  outside: [],
  disabled: [],
  selected: [],
  hidden: [],
  today: [],
  range_start: [],
  range_end: [],
  range_middle: []
};

type ModifiersTest = {
  focusedDay: string;
  skippedDay: string;
  moveBy: MoveFocusBy;
  direction: MoveFocusDirection;
  modifierName: InternalModifier;
  expectedNextFocus: string;
  fromDate?: string;
  toDate?: string;
};

const modifiersTest: ModifiersTest[] = [
  {
    focusedDay: '2022-08-17',
    skippedDay: '2022-08-18',
    moveBy: 'day',
    direction: 'after',
    modifierName: InternalModifier.Hidden,
    expectedNextFocus: '2022-08-19'
  },
  {
    focusedDay: '2022-08-17',
    skippedDay: '2022-08-18',
    moveBy: 'day',
    direction: 'after',
    modifierName: InternalModifier.Disabled,
    expectedNextFocus: '2022-08-19'
  },
  {
    focusedDay: '2022-08-17',
    skippedDay: '2022-08-16',
    moveBy: 'day',
    direction: 'before',
    modifierName: InternalModifier.Hidden,
    expectedNextFocus: '2022-08-15'
  },
  {
    focusedDay: '2022-08-17',
    skippedDay: '2022-08-16',
    moveBy: 'day',
    direction: 'before',
    modifierName: InternalModifier.Disabled,
    expectedNextFocus: '2022-08-15'
  },
  {
    focusedDay: '2022-08-17',
    skippedDay: '2022-08-16',
    fromDate: '2022-08-01',
    moveBy: 'month',
    direction: 'before',
    modifierName: InternalModifier.Disabled,
    expectedNextFocus: '2022-08-01'
  },
  {
    focusedDay: '2022-08-17',
    skippedDay: '2022-08-16',
    toDate: '2022-08-31',
    moveBy: 'month',
    direction: 'after',
    modifierName: InternalModifier.Disabled,
    expectedNextFocus: '2022-08-31'
  }
];
describe.each(modifiersTest)(
  'when focusing the $moveBy $direction $focusedDay with $modifierName modifier',
  (modifierTest) => {
    const modifiers: InternalModifiers = {
      ...emptyModifiers,
      [modifierTest.modifierName]: [parseISO(modifierTest.skippedDay)]
    };
    const context = {
      fromDate: modifierTest.fromDate
        ? parseISO(modifierTest.fromDate)
        : undefined,
      toDate: modifierTest.toDate ? parseISO(modifierTest.toDate) : undefined
    };
    test(`should skip the ${modifierTest.modifierName} day`, () => {
      const nextFocus = getNextFocus(parseISO(modifierTest.focusedDay), {
        moveBy: modifierTest.moveBy,
        direction: modifierTest.direction,
        context,
        modifiers
      });
      expect(format(nextFocus, 'yyyy-MM-dd')).toBe(
        modifierTest.expectedNextFocus
      );
    });
  }
);

test('should avoid infinite recursion', () => {
  const focusedDay = new Date(2022, 7, 17);
  const modifiers: Modifiers = {
    outside: [],
    disabled: [{ after: focusedDay }],
    selected: [],
    hidden: [],
    today: [],
    range_start: [],
    range_end: [],
    range_middle: []
  };

  const nextFocus = getNextFocus(focusedDay, {
    moveBy: 'day',
    direction: 'after',
    modifiers,
    context: {}
  });

  expect(nextFocus).toStrictEqual(focusedDay);
});
