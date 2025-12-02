import {
  FocusEventHandler,
  HTMLProps,
  KeyboardEventHandler,
  MouseEventHandler,
  PointerEventHandler,
  TouchEventHandler
} from 'react';

import { useDayPicker } from 'contexts/DayPicker';
import { useFocusContext } from 'contexts/Focus';
import { useSelectMultiple } from 'contexts/SelectMultiple';
import { useSelectRange } from 'contexts/SelectRange';
import { useSelectSingle } from 'contexts/SelectSingle';
import { isDayPickerMultiple } from 'types/DayPickerMultiple';
import { isDayPickerRange } from 'types/DayPickerRange';
import { isDayPickerSingle } from 'types/DayPickerSingle';
import { ActiveModifiers } from 'types/Modifiers';

export type EventName =
  | 'onClick'
  | 'onFocus'
  | 'onBlur'
  | 'onKeyDown'
  | 'onKeyUp'
  | 'onMouseEnter'
  | 'onMouseLeave'
  | 'onPointerEnter'
  | 'onPointerLeave'
  | 'onTouchCancel'
  | 'onTouchEnd'
  | 'onTouchMove'
  | 'onTouchStart';

export type DayEventName =
  | 'onDayClick'
  | 'onDayFocus'
  | 'onDayBlur'
  | 'onDayKeyDown'
  | 'onDayKeyUp'
  | 'onDayMouseEnter'
  | 'onDayMouseLeave'
  | 'onDayPointerEnter'
  | 'onDayPointerLeave'
  | 'onDayTouchCancel'
  | 'onDayTouchEnd'
  | 'onDayTouchMove'
  | 'onDayTouchStart';

export type DayEventHandlers = Pick<HTMLProps<HTMLButtonElement>, EventName>;

/**
 * This hook returns details about the content to render in the day cell.
 *
 *
 * When a day cell is rendered in the table, DayPicker can either:
 *
 * - render nothing: when the day is outside the month or has matched the
 *   "hidden" modifier.
 * - render a button when `onDayClick` or a selection mode is set.
 * - render a non-interactive element: when no selection mode is set, the day
 *   cell shouldn’t respond to any interaction. DayPicker should render a `div`
 *   or a `span`.
 *
 * ### Usage
 *
 * Use this hook to customize the behavior of the {@link Day} component. Create a
 * new `Day` component using this hook and pass it to the `components` prop.
 * The source of {@link Day} can be a good starting point.
 *
 */
export function useDayEventHandlers(
  date: Date,
  activeModifiers: ActiveModifiers
): DayEventHandlers {
  const dayPicker = useDayPicker();
  const single = useSelectSingle();
  const multiple = useSelectMultiple();
  const range = useSelectRange();
  const {
    focusDayAfter,
    focusDayBefore,
    focusWeekAfter,
    focusWeekBefore,
    blur,
    focus,
    focusMonthBefore,
    focusMonthAfter,
    focusYearBefore,
    focusYearAfter,
    focusStartOfWeek,
    focusEndOfWeek
  } = useFocusContext();

  const onClick: MouseEventHandler = (e) => {
    if (isDayPickerSingle(dayPicker)) {
      single.onDayClick?.(date, activeModifiers, e);
    } else if (isDayPickerMultiple(dayPicker)) {
      multiple.onDayClick?.(date, activeModifiers, e);
    } else if (isDayPickerRange(dayPicker)) {
      range.onDayClick?.(date, activeModifiers, e);
    } else {
      dayPicker.onDayClick?.(date, activeModifiers, e);
    }
  };

  const onFocus: FocusEventHandler = (e) => {
    focus(date);
    dayPicker.onDayFocus?.(date, activeModifiers, e);
  };

  const onBlur: FocusEventHandler = (e) => {
    blur();
    dayPicker.onDayBlur?.(date, activeModifiers, e);
  };

  const onMouseEnter: MouseEventHandler = (e) => {
    dayPicker.onDayMouseEnter?.(date, activeModifiers, e);
  };
  const onMouseLeave: MouseEventHandler = (e) => {
    dayPicker.onDayMouseLeave?.(date, activeModifiers, e);
  };
  const onPointerEnter: PointerEventHandler = (e) => {
    dayPicker.onDayPointerEnter?.(date, activeModifiers, e);
  };
  const onPointerLeave: PointerEventHandler = (e) => {
    dayPicker.onDayPointerLeave?.(date, activeModifiers, e);
  };
  const onTouchCancel: TouchEventHandler = (e) => {
    dayPicker.onDayTouchCancel?.(date, activeModifiers, e);
  };
  const onTouchEnd: TouchEventHandler = (e) => {
    dayPicker.onDayTouchEnd?.(date, activeModifiers, e);
  };
  const onTouchMove: TouchEventHandler = (e) => {
    dayPicker.onDayTouchMove?.(date, activeModifiers, e);
  };
  const onTouchStart: TouchEventHandler = (e) => {
    dayPicker.onDayTouchStart?.(date, activeModifiers, e);
  };

  const onKeyUp: KeyboardEventHandler = (e) => {
    dayPicker.onDayKeyUp?.(date, activeModifiers, e);
  };

  const onKeyDown: KeyboardEventHandler = (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        dayPicker.dir === 'rtl' ? focusDayAfter() : focusDayBefore();
        break;
      case 'ArrowRight':
        e.preventDefault();
        e.stopPropagation();
        dayPicker.dir === 'rtl' ? focusDayBefore() : focusDayAfter();
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        focusWeekAfter();
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        focusWeekBefore();
        break;
      case 'PageUp':
        e.preventDefault();
        e.stopPropagation();
        e.shiftKey ? focusYearBefore() : focusMonthBefore();
        break;
      case 'PageDown':
        e.preventDefault();
        e.stopPropagation();
        e.shiftKey ? focusYearAfter() : focusMonthAfter();
        break;
      case 'Home':
        e.preventDefault();
        e.stopPropagation();
        focusStartOfWeek();
        break;
      case 'End':
        e.preventDefault();
        e.stopPropagation();
        focusEndOfWeek();
        break;
    }
    dayPicker.onDayKeyDown?.(date, activeModifiers, e);
  };

  const eventHandlers: DayEventHandlers = {
    onClick,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    onMouseEnter,
    onMouseLeave,
    onPointerEnter,
    onPointerLeave,
    onTouchCancel,
    onTouchEnd,
    onTouchMove,
    onTouchStart
  };

  return eventHandlers;
}
