import { DayPickerProps } from 'DayPicker';

import { mockedContexts } from 'test/mockedContexts';
import { renderDayPickerHook } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { useSelectedDays } from './useSelectedDays';

const today = new Date(2021, 11, 8);
freezeBeforeAll(today);

function renderHook(dayPickerProps: DayPickerProps) {
  return renderDayPickerHook(
    () => useSelectedDays(),
    dayPickerProps,
    mockedContexts
  );
}

describe('when in single selection mode', () => {
  const mode = 'single';
  test('should return the selection from the single context', () => {
    const result = renderHook({ mode, selected: today });
    expect(result.current).toBe(mockedContexts.single.selected);
  });
});

describe('when in multiple selection mode', () => {
  const mode = 'multiple';
  test('should return the selection from the multiple context', () => {
    const result = renderHook({ mode });
    expect(result.current).toBe(mockedContexts.multiple.selected);
  });
});

describe('when in range selection mode', () => {
  const mode = 'range';
  test('should return the selection from the range context', () => {
    const result = renderHook({ mode });
    expect(result.current).toBe(mockedContexts.range.selected);
  });
});
