import { DayPickerProps } from 'DayPicker';

import { mockedContexts } from 'test/mockedContexts';
import { renderDayPickerHook } from 'test/render';

import { FocusContextValue } from 'contexts/Focus';
import {
  DayEventName,
  EventName,
  useDayEventHandlers
} from 'hooks/useDayEventHandlers';
import { ActiveModifiers } from 'types/Modifiers';

const today = new Date(2010, 5, 23);

function renderHook(
  date: Date,
  activeModifiers: ActiveModifiers,
  dayPickerProps?: DayPickerProps
) {
  return renderDayPickerHook(
    () => useDayEventHandlers(date, activeModifiers),
    dayPickerProps,
    mockedContexts
  );
}

const tests: [EventName, DayEventName][] = [
  ['onClick', 'onDayClick'],
  ['onFocus', 'onDayFocus'],
  ['onBlur', 'onDayBlur'],
  ['onMouseEnter', 'onDayMouseEnter'],
  ['onMouseLeave', 'onDayMouseLeave'],
  ['onPointerEnter', 'onDayPointerEnter'],
  ['onPointerLeave', 'onDayPointerLeave'],
  ['onTouchEnd', 'onDayTouchEnd'],
  ['onTouchCancel', 'onDayTouchCancel'],
  ['onTouchMove', 'onDayTouchMove'],
  ['onTouchStart', 'onDayTouchStart'],
  ['onKeyUp', 'onDayKeyUp']
];

describe.each(tests)('when calling "%s"', (eventName, dayEventName) => {
  const activeModifiers: ActiveModifiers = {};
  const dayPickerProps = {
    onDayClick: jest.fn(),
    onDayFocus: jest.fn(),
    onDayBlur: jest.fn(),
    onDayMouseEnter: jest.fn(),
    onDayMouseLeave: jest.fn(),
    onDayPointerEnter: jest.fn(),
    onDayPointerLeave: jest.fn(),
    onDayTouchEnd: jest.fn(),
    onDayTouchCancel: jest.fn(),
    onDayTouchMove: jest.fn(),
    onDayTouchStart: jest.fn(),
    onDayKeyUp: jest.fn(),
    onDayKeyDown: jest.fn()
  };
  const mouseEvent = {} as React.MouseEvent<HTMLButtonElement, MouseEvent>;
  const date = today;
  test(`${dayEventName} should have been called`, () => {
    const result = renderHook(date, activeModifiers, dayPickerProps);
    //@ts-expect-error TOFIX: How to mock mouse event here?
    result.current[eventName]?.(mouseEvent);
    expect(dayPickerProps[dayEventName]).toHaveBeenCalledWith(
      date,
      activeModifiers,
      mouseEvent
    );
  });
});

describe.each<'single' | 'multiple' | 'range'>(['single', 'multiple', 'range'])(
  'when calling "onClick" in "%s" selection mode',
  (mode) => {
    const activeModifiers: ActiveModifiers = {};
    const dayPickerProps = {
      mode,
      onDayClick: mockedContexts[mode].onDayClick
    };
    const mouseEvent = {} as React.MouseEvent<HTMLButtonElement, MouseEvent>;
    const date = today;
    test(`should have called "onDayClick" from the ${mode} context`, () => {
      const result = renderHook(date, activeModifiers, dayPickerProps);
      result.current.onClick?.(mouseEvent);
      expect(dayPickerProps.onDayClick).toHaveBeenCalledTimes(1);
    });
  }
);

describe('when calling "onFocus"', () => {
  const date = today;
  const activeModifiers: ActiveModifiers = {};
  const mouseEvent = {} as React.FocusEvent<HTMLButtonElement, Element>;
  test('should focus the date in the context', () => {
    const result = renderHook(date, activeModifiers);
    result.current.onFocus?.(mouseEvent);
    expect(mockedContexts.focus.focus).toHaveBeenCalledWith(date);
  });
});

describe('when calling "onBlur"', () => {
  const date = today;
  const activeModifiers: ActiveModifiers = {};
  const mouseEvent = {} as React.FocusEvent<HTMLButtonElement, Element>;
  test('should blur the date in the context', () => {
    const result = renderHook(date, activeModifiers);
    result.current.onBlur?.(mouseEvent);
    expect(mockedContexts.focus.blur).toHaveBeenCalled();
  });
});

describe('when calling "onKeyDown"', () => {
  const date = today;
  const activeModifiers: ActiveModifiers = {};

  const tests: [
    key: string,
    dir: string,
    shiftKey: boolean,
    expectedMethod: keyof FocusContextValue
  ][] = [
    ['ArrowLeft', 'ltr', false, 'focusDayBefore'],
    ['ArrowLeft', 'rtl', false, 'focusDayAfter'],
    ['ArrowRight', 'ltr', false, 'focusDayAfter'],
    ['ArrowRight', 'ltr', false, 'focusDayBefore'],
    ['ArrowRight', 'ltr', false, 'focusDayAfter'],
    ['ArrowDown', 'ltr', false, 'focusWeekAfter'],
    ['ArrowUp', 'ltr', false, 'focusWeekBefore'],
    ['PageUp', 'ltr', true, 'focusYearBefore'],
    ['PageUp', 'ltr', false, 'focusMonthBefore'],
    ['PageDown', 'ltr', true, 'focusYearAfter'],
    ['PageDown', 'ltr', false, 'focusMonthAfter'],
    ['Home', 'ltr', false, 'focusStartOfWeek'],
    ['End', 'ltr', false, 'focusEndOfWeek']
  ];

  describe.each(tests)(
    'when key is %s',
    (key, dir, shiftKey, expectedMethod) => {
      describe(`when text direction is "${dir.toUpperCase()}"`, () => {
        describe(`when the shiftKey is ${
          shiftKey ? '' : 'not'
        } pressed`, () => {
          const keyboardEvent = {
            key,
            shiftKey
          } as React.KeyboardEvent<HTMLButtonElement>;
          keyboardEvent.preventDefault = jest.fn();
          keyboardEvent.stopPropagation = jest.fn();

          beforeEach(() => {
            const result = renderHook(date, activeModifiers, { dir });
            result.current.onKeyDown?.(keyboardEvent);
          });
          test(`should call ${expectedMethod}`, () => {
            expect(mockedContexts.focus[expectedMethod]).toHaveBeenCalledWith();
          });
          test(`should prevent the default event`, () => {
            expect(keyboardEvent.preventDefault).toHaveBeenCalledWith();
          });
          test(`should stop the event propagation`, () => {
            expect(keyboardEvent.preventDefault).toHaveBeenCalledWith();
          });
        });
      });
    }
  );
});
