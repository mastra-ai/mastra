import { MouseEvent } from 'react';

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  subDays
} from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { renderDayPickerHook } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { isMatch } from 'contexts/Modifiers/utils/isMatch';
import { DayPickerRangeProps } from 'types/DayPickerRange';
import { ActiveModifiers } from 'types/Modifiers';

import { SelectRangeContextValue, useSelectRange } from './SelectRangeContext';

const today = new Date(2021, 11, 8);
freezeBeforeAll(today);

function renderHook(props?: Partial<DayPickerProps>) {
  return renderDayPickerHook<SelectRangeContextValue>(useSelectRange, props);
}
describe('when is not a multiple select DayPicker', () => {
  test('the selected day should be undefined', () => {
    const result = renderHook();
    expect(result.current.selected).toBeUndefined();
  });
});

const initialProps: DayPickerRangeProps = {
  mode: 'range',
  onDayClick: jest.fn(),
  onSelect: jest.fn()
};

const from = today;
const to = addDays(today, 6);
const stubEvent = {} as MouseEvent;

describe('when no days are selected', () => {
  test('the selected days should be undefined', () => {
    const result = renderHook();
    expect(result.current.selected).toBeUndefined();
  });
  describe('when "onDayClick" is called', () => {
    const day = from;
    const activeModifiers = {};
    beforeAll(() => {
      const result = renderHook(initialProps);
      result.current.onDayClick?.(day, activeModifiers, stubEvent);
    });
    afterAll(() => {
      jest.resetAllMocks();
    });
    test('should call the "onDayClick" from the DayPicker props', () => {
      expect(initialProps.onDayClick).toHaveBeenCalledWith(
        day,
        activeModifiers,
        stubEvent
      );
    });
    test('should call "onSelect" with the clicked day as the "from" prop', () => {
      expect(initialProps.onSelect).toHaveBeenCalledWith(
        { from: day, to: undefined },
        day,
        activeModifiers,
        stubEvent
      );
    });
  });
});

describe('when only the "from" day is selected', () => {
  const selected = { from, to: undefined };
  const dayPickerProps: DayPickerRangeProps = {
    ...initialProps,
    selected
  };
  test('should return the "range_start" modifiers with the "from" day', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_start).toEqual([from]);
  });
  test('should return the "range_end" modifiers with the "from" day', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_end).toEqual([from]);
  });
  test('should not return any "range_middle" modifiers', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_middle).toEqual([]);
  });
});

describe('when only the "to" day is selected', () => {
  const selected = { from: undefined, to };
  const dayPickerProps: DayPickerRangeProps = {
    ...initialProps,
    selected
  };
  test('should return the "range_start" modifiers with the "to" day', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_start).toEqual([to]);
  });
  test('should return the "range_end" modifiers with the "to" day', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_end).toEqual([to]);
  });
  test('should not return any "range_middle" modifiers', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_middle).toEqual([]);
  });
});

describe('when a complete range of days is selected', () => {
  const selected = { from, to };
  const dayPickerProps: DayPickerRangeProps = {
    ...initialProps,
    selected
  };
  test('should return the "range_start" modifiers with the "from" day', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_start).toEqual([from]);
  });
  test('should return the "range_end" modifiers with the "to" day', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_end).toEqual([to]);
  });
  test('should return the "range_middle" range modifiers', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_middle).toEqual([
      { after: from, before: to }
    ]);
  });
  describe('when "onDayClick" is called with the day before the from day', () => {
    const day = addDays(from, -1);
    const activeModifiers = {};

    beforeAll(() => {
      const result = renderHook(dayPickerProps);
      result.current.onDayClick?.(day, activeModifiers, stubEvent);
    });
    afterAll(() => {
      jest.resetAllMocks();
    });
    test('should call the "onDayClick" from the DayPicker props', () => {
      expect(dayPickerProps.onDayClick).toHaveBeenCalledWith(
        day,
        activeModifiers,
        stubEvent
      );
    });
    test('should call "onSelect" with the day selected', () => {
      expect(dayPickerProps.onSelect).toHaveBeenCalledWith(
        { from: day, to },
        day,
        activeModifiers,
        stubEvent
      );
    });
  });
});

describe('when "from" and "to" are the same', () => {
  const date = new Date();
  const selected = { from: date, to: date };
  const dayPickerProps: DayPickerRangeProps = {
    ...initialProps,
    selected
  };
  test('should return the "range_start" modifier with the date', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_start).toEqual([date]);
  });
  test('should return the "range_end" modifier with the date', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_end).toEqual([date]);
  });
  test('should return an empty "range_middle"', () => {
    const result = renderHook(dayPickerProps);
    expect(result.current.modifiers.range_middle).toEqual([]);
  });
});

describe('when the max number of the selected days is reached', () => {
  const from = today;
  const to = addDays(today, 6);
  const selected = { from, to };
  const dayPickerProps: DayPickerRangeProps = {
    ...initialProps,
    selected,
    max: 7
  };
  test('the days in the range should not be disabled', () => {
    const result = renderHook(dayPickerProps);
    const { disabled } = result.current.modifiers;
    expect(isMatch(from, disabled)).toBe(false);
    expect(isMatch(to, disabled)).toBe(false);
  });
  test('the other days should be disabled', () => {
    const result = renderHook(dayPickerProps);
    const { disabled } = result.current.modifiers;
    expect(isMatch(addMonths(from, 1), disabled)).toBe(true);
  });
  describe('when "onDayClick" is called with a new day', () => {
    const day = addMonths(from, 1);
    const activeModifiers: ActiveModifiers = {};

    beforeAll(() => {
      const result = renderHook(dayPickerProps);
      result.current.onDayClick?.(day, activeModifiers, stubEvent);
    });
    afterAll(() => {
      jest.resetAllMocks();
    });
    test('should call the "onDayClick" from the DayPicker props', () => {
      expect(dayPickerProps.onDayClick).toHaveBeenCalledWith(
        day,
        activeModifiers,
        stubEvent
      );
    });
  });
});

describe('when the minimum number of days are selected', () => {
  const selected = { from, to };
  const dayPickerProps: DayPickerRangeProps = {
    ...initialProps,
    selected,
    min: Math.abs(differenceInCalendarDays(to, from))
  };
  describe('when "onDayClick" is called with a day before "from"', () => {
    const day = subDays(from, 1);
    const activeModifiers: ActiveModifiers = { selected: true };

    beforeAll(() => {
      const result = renderHook(dayPickerProps);
      result.current.onDayClick?.(day, activeModifiers, stubEvent);
    });
    afterAll(() => {
      jest.resetAllMocks();
    });
    test('should call "onSelect" with the day included in the range', () => {
      expect(dayPickerProps.onSelect).toHaveBeenCalledWith(
        { from: day, to },
        day,
        activeModifiers,
        stubEvent
      );
    });
  });
  describe('when "onDayClick" is called with the "from" day', () => {
    const day = from;
    const activeModifiers: ActiveModifiers = { selected: true };
    beforeAll(() => {
      const result = renderHook(dayPickerProps);
      result.current.onDayClick?.(day, activeModifiers, stubEvent);
    });
    afterAll(() => {
      jest.resetAllMocks();
    });

    test('should call the "onDayClick" from the DayPicker props', () => {
      expect(dayPickerProps.onDayClick).toHaveBeenCalledWith(
        day,
        activeModifiers,
        stubEvent
      );
    });
    test('should call "onSelect" with an undefined range', () => {
      expect(dayPickerProps.onSelect).toHaveBeenCalledWith(
        undefined,
        day,
        activeModifiers,
        stubEvent
      );
    });
  });

  describe('when "onDayClick" is called with the "to" day', () => {
    const day = to;
    const activeModifiers: ActiveModifiers = { selected: true };
    beforeAll(() => {
      const result = renderHook(dayPickerProps);
      result.current.onDayClick?.(day, activeModifiers, stubEvent);
    });
    afterAll(() => {
      jest.resetAllMocks();
    });

    test('should call "onSelect" without the "to" in the range', () => {
      expect(dayPickerProps.onSelect).toHaveBeenCalledWith(
        { from: day, to: undefined },
        day,
        activeModifiers,
        stubEvent
      );
    });
  });
});
