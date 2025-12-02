import { act } from '@testing-library/react';
import { addMonths, startOfMonth, subMonths } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { renderDayPickerHook, RenderHookResult } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { NavigationContextValue, useNavigation } from './NavigationContext';

const today = new Date(2021, 11, 8);
const todaysMonth = startOfMonth(today);
freezeBeforeAll(today);

function renderHook(props: Partial<DayPickerProps> = {}) {
  return renderDayPickerHook<NavigationContextValue>(useNavigation, props);
}

let result: RenderHookResult<NavigationContextValue>;
describe('when rendered', () => {
  beforeEach(() => {
    result = renderHook();
  });
  test('the current month should be the today`s month', () => {
    expect(result.current.currentMonth).toEqual(todaysMonth);
  });
  test('the display months should be the today`s month', () => {
    expect(result.current.displayMonths).toEqual([todaysMonth]);
  });
  test('the previous month should be the month before today`s month', () => {
    expect(result.current.previousMonth).toEqual(subMonths(todaysMonth, 1));
  });
  test('the next month should be the month after today`s month', () => {
    expect(result.current.nextMonth).toEqual(addMonths(todaysMonth, 1));
  });
  describe('when goToMonth is called', () => {
    const newMonth = addMonths(todaysMonth, 10);
    beforeEach(() => {
      result = renderHook();
      act(() => result.current.goToMonth(newMonth));
    });
    test('should go to the specified month', () => {
      expect(result.current.currentMonth).toEqual(newMonth);
    });
    test('the display months should be the today`s month', () => {
      expect(result.current.displayMonths).toEqual([newMonth]);
    });
    test('the previous month should be the month before today`s month', () => {
      expect(result.current.previousMonth).toEqual(subMonths(newMonth, 1));
    });
    test('the next month should be the month after today`s month', () => {
      expect(result.current.nextMonth).toEqual(addMonths(newMonth, 1));
    });
  });
  describe('when goToDate is called with a date from another month', () => {
    const newDate = addMonths(today, 10);
    const onMonthChange = jest.fn();
    beforeEach(() => {
      result = renderHook({ onMonthChange });
      act(() => result.current.goToDate(newDate));
    });
    test('should go to the specified month', () => {
      const date = startOfMonth(newDate);
      expect(result.current.currentMonth).toEqual(date);
      expect(onMonthChange).toHaveBeenCalledWith(date);
    });
  });
  describe('when isDateDisplayed is called', () => {
    describe('with a date in the calendar', () => {
      test('should return true', () => {
        expect(result.current.isDateDisplayed(today)).toBe(true);
      });
    });
    describe('with a date not in the calendar', () => {
      test('should return false', () => {
        expect(result.current.isDateDisplayed(addMonths(today, 1))).toBe(false);
      });
    });
  });
});

const numberOfMonths = 2;
describe('when the number of months is ${numberOfMonths}', () => {
  beforeEach(() => {
    result = renderHook({ numberOfMonths: 2 });
  });
  test('the current month should be the today`s month', () => {
    expect(result.current.currentMonth).toEqual(todaysMonth);
  });
  test('the display months should be the today`s and next month', () => {
    expect(result.current.displayMonths).toEqual([
      todaysMonth,
      addMonths(todaysMonth, 1)
    ]);
  });
  test('the previous month should be the month before today`s month', () => {
    expect(result.current.previousMonth).toEqual(subMonths(todaysMonth, 1));
  });
  test('the next month should be the month after today`s month', () => {
    expect(result.current.nextMonth).toEqual(addMonths(todaysMonth, 1));
  });
});

describe(`when the number of months is ${numberOfMonths} and the navigation is paged`, () => {
  beforeEach(() => {
    result = renderHook({ numberOfMonths, pagedNavigation: true });
  });
  test('the current month should be the today`s month', () => {
    expect(result.current.currentMonth).toEqual(todaysMonth);
  });
  test('the display months should be the today`s and next month', () => {
    expect(result.current.displayMonths).toEqual([
      todaysMonth,
      addMonths(todaysMonth, 1)
    ]);
  });
  test(`the previous month should be the ${numberOfMonths} months before today's month`, () => {
    expect(result.current.previousMonth).toEqual(
      subMonths(todaysMonth, numberOfMonths)
    );
  });
  test(`the next month should be ${numberOfMonths} months after today's month`, () => {
    expect(result.current.nextMonth).toEqual(
      addMonths(todaysMonth, numberOfMonths)
    );
  });
});
