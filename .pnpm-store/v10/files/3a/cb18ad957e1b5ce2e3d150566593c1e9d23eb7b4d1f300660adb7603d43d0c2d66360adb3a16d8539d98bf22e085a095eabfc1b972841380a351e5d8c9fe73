import { MouseEvent } from 'react';

import { DayPickerProps } from 'DayPicker';

import { renderDayPickerHook } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { DayPickerSingleProps } from 'types/DayPickerSingle';
import { ActiveModifiers } from 'types/Modifiers';

import {
  SelectSingleContextValue,
  useSelectSingle
} from './SelectSingleContext';

const today = new Date(2021, 11, 8);
freezeBeforeAll(today);

function renderHook(props?: Partial<DayPickerProps>) {
  return renderDayPickerHook<SelectSingleContextValue>(useSelectSingle, props);
}
describe('when is not a single select DayPicker', () => {
  test('the selected day should be undefined', () => {
    const result = renderHook();
    expect(result.current.selected).toBeUndefined();
  });
});

describe('when a day is selected from DayPicker props', () => {
  test('the selected day should be today', () => {
    const dayPickerProps: DayPickerSingleProps = {
      mode: 'single',
      selected: today
    };
    const result = renderHook(dayPickerProps);
    expect(result.current.selected).toBe(today);
  });
});
describe('when onDayClick is called', () => {
  const dayPickerProps: DayPickerSingleProps = {
    mode: 'single',
    onSelect: jest.fn(),
    onDayClick: jest.fn()
  };
  const result = renderHook(dayPickerProps);
  const activeModifiers = {};
  const event = {} as MouseEvent;
  test('should call the `onSelect` event handler', () => {
    result.current.onDayClick?.(today, activeModifiers, event);
    expect(dayPickerProps.onSelect).toHaveBeenCalledWith(
      today,
      today,
      activeModifiers,
      event
    );
  });
  test('should call the `onDayClick` event handler', () => {
    result.current.onDayClick?.(today, activeModifiers, event);
    expect(dayPickerProps.onDayClick).toHaveBeenCalledWith(
      today,
      activeModifiers,
      event
    );
  });
});
describe('if a selected day is not required', () => {
  const dayPickerProps: DayPickerSingleProps = {
    mode: 'single',
    onSelect: jest.fn(),
    required: false
  };
  test('should call the `onSelect` event handler with an undefined day', () => {
    const result = renderHook(dayPickerProps);
    const activeModifiers: ActiveModifiers = { selected: true };
    const event = {} as MouseEvent;
    result.current.onDayClick?.(today, activeModifiers, event);
    expect(dayPickerProps.onSelect).toHaveBeenCalledWith(
      undefined,
      today,
      activeModifiers,
      event
    );
  });
});
