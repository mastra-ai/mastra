import { createRef } from 'react';

import { addDays, addMonths } from 'date-fns';
import { DayPickerProps } from 'DayPicker';

import { mockedContexts } from 'test/mockedContexts';
import { renderDayPickerHook } from 'test/render';
import { freezeBeforeAll } from 'test/utils';

import { defaultClassNames } from 'contexts/DayPicker/defaultClassNames';
import { FocusContextValue } from 'contexts/Focus';
import { SelectMultipleContextValue } from 'contexts/SelectMultiple';
import { SelectRangeContextValue } from 'contexts/SelectRange';
import { SelectSingleContextValue } from 'contexts/SelectSingle';
import { EventName } from 'hooks/useDayEventHandlers';

import { useDayRender } from './useDayRender';

const today = new Date(2022, 5, 13);

freezeBeforeAll(today);

function renderHook(
  date: Date,
  displayMonth: Date,
  dayPickerProps?: DayPickerProps,
  contexts?: {
    single: SelectSingleContextValue;
    multiple: SelectMultipleContextValue;
    range: SelectRangeContextValue;
    focus: FocusContextValue;
  }
) {
  const buttonRef = createRef<HTMLButtonElement>();
  return renderDayPickerHook(
    () => useDayRender(date, displayMonth, buttonRef),
    dayPickerProps,
    contexts
  );
}

describe('when rendering the today’s date', () => {
  const date = today;
  const displayMonth = date;
  test('the div should include the default class name', () => {
    const result = renderHook(date, displayMonth);
    expect(result.current.divProps.className?.split(' ')).toContain(
      defaultClassNames.day
    );
  });
  test('the button should include the default class name', () => {
    const result = renderHook(date, displayMonth);
    expect(result.current.buttonProps.className?.split(' ')).toContain(
      defaultClassNames.day
    );
  });
  test('the button should not have "aria-selected"', () => {
    const result = renderHook(date, displayMonth);
    expect(result.current.buttonProps['aria-selected']).toBeUndefined();
  });
  test('the button should have 0 as "tabIndex"', () => {
    const result = renderHook(date, displayMonth);
    expect(result.current.buttonProps.tabIndex).toBe(0);
  });

  const testEvents: EventName[] = [
    'onClick',
    'onFocus',
    'onBlur',
    'onKeyDown',
    'onKeyUp',
    'onMouseEnter',
    'onMouseLeave',
    'onTouchCancel',
    'onTouchEnd',
    'onTouchMove',
    'onTouchStart'
  ];
  test.each(testEvents)(
    'the button should have the "%s" event handler',
    (eventName) => {
      const result = renderHook(date, displayMonth);
      expect(result.current.buttonProps[eventName]).toBeDefined();
    }
  );
  test('should return the day active modifiers', () => {
    const result = renderHook(date, displayMonth);
    expect(result.current.activeModifiers).toEqual({ today: true });
  });
});

describe('when not in selection mode', () => {
  const dayPickerProps = { mode: undefined };
  test('should not be a button', () => {
    const result = renderHook(today, today, dayPickerProps);
    expect(result.current.isButton).toBe(false);
  });
});
describe('when "onDayClick" is not passed in', () => {
  const dayPickerProps = { onDayClick: undefined };
  test('should not be a button', () => {
    const result = renderHook(today, today, dayPickerProps);
    expect(result.current.isButton).toBe(false);
  });
});
describe('when in selection mode', () => {
  const dayPickerProps: DayPickerProps = { mode: 'single' };
  test('should be a button', () => {
    const result = renderHook(today, today, dayPickerProps);
    expect(result.current.isButton).toBe(true);
  });
});

describe('when "onDayClick" is passed in', () => {
  const dayPickerProps: DayPickerProps = { onDayClick: jest.fn() };
  test('should be a button', () => {
    const result = renderHook(today, today, dayPickerProps);
    expect(result.current.isButton).toBe(true);
  });
});

describe('when showing the outside days', () => {
  const dayPickerProps: DayPickerProps = { showOutsideDays: false };
  describe('when the day is outside', () => {
    const day = today;
    const displayMonth = addMonths(today, 1);
    test('should be hidden', () => {
      const result = renderHook(day, displayMonth, dayPickerProps);
      expect(result.current.isHidden).toBe(true);
    });
  });
});

describe('when the day has the "hidden" modifier active', () => {
  const date = today;
  const dayPickerProps: DayPickerProps = {
    modifiers: { hidden: date }
  };
  test('should have the hidden modifier active', () => {
    const result = renderHook(date, date, dayPickerProps);
    expect(result.current.activeModifiers.hidden).toBe(true);
  });
  test('should be hidden', () => {
    const result = renderHook(date, date, dayPickerProps);
    expect(result.current.isHidden).toBe(true);
  });
});

describe('when "modifiersStyles" is passed in', () => {
  const date = today;
  const dayPickerProps = {
    modifiers: { foo: date },
    modifiersStyles: { foo: { color: 'red' } }
  };
  test('the div props should include the modifiers style', () => {
    const result = renderHook(date, date, dayPickerProps);
    expect(result.current.divProps.style).toStrictEqual(
      dayPickerProps.modifiersStyles.foo
    );
  });
  test('the button props should include the modifiers style', () => {
    const result = renderHook(date, date, dayPickerProps);
    expect(result.current.buttonProps.style).toStrictEqual(
      dayPickerProps.modifiersStyles.foo
    );
  });
});
describe('when "styles.day" is passed in', () => {
  const date = today;
  const dayPickerProps = {
    styles: { day: { color: 'red' } }
  };
  test('the div props should include the style', () => {
    const result = renderHook(date, date, dayPickerProps);
    expect(result.current.divProps.style).toStrictEqual(
      dayPickerProps.styles.day
    );
  });
  test('the button props should include the style', () => {
    const result = renderHook(date, date, dayPickerProps);
    expect(result.current.buttonProps.style).toStrictEqual(
      dayPickerProps.styles.day
    );
  });
});

describe('when "modifiersClassNames" is passed in', () => {
  const date = today;
  const dayPickerProps = {
    modifiers: { foo: date },
    modifiersClassNames: { foo: 'bar' }
  };
  const result = renderHook(date, date, dayPickerProps);
  test('the div props should include the modifiers classNames', () => {
    expect(result.current.divProps.className).toContain(
      dayPickerProps.modifiersClassNames.foo
    );
  });
  test('the button props should include the modifiers classNames', () => {
    expect(result.current.buttonProps.className).toContain(
      dayPickerProps.modifiersClassNames.foo
    );
  });
});

describe('when "classNames.day" is passed in', () => {
  const date = today;
  const dayPickerProps = {
    classNames: { day: 'foo' }
  };
  const result = renderHook(date, date, dayPickerProps);
  test('the div props should include the class name', () => {
    expect(result.current.divProps.className).toContain(
      dayPickerProps.classNames.day
    );
  });
  test('the button props should include the class name', () => {
    expect(result.current.buttonProps.className).toContain(
      dayPickerProps.classNames.day
    );
  });
});

describe('when the day is not target of focus', () => {
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const focusContext: FocusContextValue = {
    ...mockedContexts.focus,
    focusTarget: yesterday
  };
  const result = renderHook(
    tomorrow,
    tomorrow,
    {},
    { ...mockedContexts, focus: focusContext }
  );
  test('the button should have tabIndex -1', () => {
    expect(result.current.buttonProps.tabIndex).toBe(-1);
  });
});

describe('when the day is target of focus', () => {
  const date = today;
  const focusContext: FocusContextValue = {
    ...mockedContexts.focus,
    focusTarget: date
  };
  const result = renderHook(
    date,
    date,
    {},
    { ...mockedContexts, focus: focusContext }
  );
  test('the button should have tabIndex 0', () => {
    expect(result.current.buttonProps.tabIndex).toBe(0);
  });
});

describe('when the day is target of focus but outside', () => {
  const date = today;
  const focusContext: FocusContextValue = {
    ...mockedContexts.focus,
    focusTarget: date
  };
  const result = renderHook(
    date,
    date,
    { modifiers: { outside: date } },
    { ...mockedContexts, focus: focusContext }
  );
  test('the button should have tabIndex -1', () => {
    expect(result.current.buttonProps.tabIndex).toBe(-1);
  });
});

describe('when the day is focused', () => {
  const date = today;
  const focusContext: FocusContextValue = {
    ...mockedContexts.focus,
    focusedDay: date
  };
  const result = renderHook(
    date,
    date,
    {},
    { ...mockedContexts, focus: focusContext }
  );

  test('the button should have tabIndex 0', () => {
    expect(result.current.buttonProps.tabIndex).toBe(0);
  });
});

describe('when the day is disabled', () => {
  const date = today;
  const dayPickerProps = { disabled: date };
  const result = renderHook(date, date, dayPickerProps);
  test('the button should be disabled', () => {
    expect(result.current.buttonProps.disabled).toBe(true);
  });
});

describe('when the day is selected', () => {
  const date = today;
  const dayPickerProps = { selected: date };
  const result = renderHook(date, date, dayPickerProps);
  test('the button should have "aria-pressed"', () => {
    expect(result.current.buttonProps['aria-selected']).toBe(true);
  });
});
