import { act } from '@testing-library/react';
import { addMonths, startOfMonth } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { renderDayPickerHook } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { NavigationState, useNavigationState } from './useNavigationState';

const today = new Date(2021, 11, 8);
freezeBeforeAll(today);

function renderHook(props: Partial<DayPickerProps> = {}) {
  return renderDayPickerHook<NavigationState>(useNavigationState, props);
}

describe('when goToMonth is called', () => {
  test('should set the month in state', () => {
    const onMonthChange = jest.fn();
    const result = renderHook({ onMonthChange });
    const month = addMonths(today, 2);
    act(() => result.current[1](month));
    expect(result.current[0]).toEqual(startOfMonth(month));
    expect(onMonthChange).toHaveBeenCalledWith(startOfMonth(month));
  });
  describe('when navigation is disabled', () => {
    test('should not set the month in state', () => {
      const onMonthChange = jest.fn();
      const result = renderHook({ disableNavigation: true, onMonthChange });
      const month = addMonths(today, 2);
      result.current[1](month);
      expect(result.current[0]).toEqual(startOfMonth(today));
      expect(onMonthChange).not.toHaveBeenCalled();
    });
  });
});
