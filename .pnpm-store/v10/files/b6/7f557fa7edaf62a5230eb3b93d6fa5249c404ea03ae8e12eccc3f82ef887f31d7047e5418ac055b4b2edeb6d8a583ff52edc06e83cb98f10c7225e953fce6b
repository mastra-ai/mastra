import {
  ChangeEventHandler,
  FocusEventHandler,
  InputHTMLAttributes,
  useState
} from 'react';

import { differenceInCalendarDays, format as _format, parse } from 'date-fns';
import { enUS } from 'date-fns/locale';

import { parseFromToProps } from 'contexts/DayPicker/utils';
import { DayPickerBase } from 'types/DayPickerBase';
import { DayPickerSingleProps } from 'types/DayPickerSingle';
import {
  DayClickEventHandler,
  MonthChangeEventHandler
} from 'types/EventHandlers';

import { isValidDate } from './utils/isValidDate';

/** The props to attach to the input field when using {@link useInput}. */
export type InputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'onBlur' | 'onChange' | 'onFocus' | 'value' | 'placeholder'
>;

/** The props to attach to the DayPicker component when using {@link useInput}. */
export type InputDayPickerProps = Pick<
  DayPickerSingleProps,
  | 'fromDate'
  | 'toDate'
  | 'locale'
  | 'month'
  | 'onDayClick'
  | 'onMonthChange'
  | 'selected'
  | 'today'
>;

export interface UseInputOptions
  extends Pick<
    DayPickerBase,
    | 'locale'
    | 'fromDate'
    | 'toDate'
    | 'fromMonth'
    | 'toMonth'
    | 'fromYear'
    | 'toYear'
    | 'today'
  > {
  /** The initially selected date */
  defaultSelected?: Date;
  /**
   * The format string for formatting the input field. See
   * https://date-fns.org/docs/format for a list of format strings.
   *
   * @defaultValue PP
   */
  format?: string;
  /** Make the selection required. */
  required?: boolean;
}

/** Represent the value returned by {@link useInput}. */
export interface UseInputValue {
  /** The props to pass to a DayPicker component. */
  dayPickerProps: InputDayPickerProps;
  /** The props to pass to an input field. */
  inputProps: InputProps;
  /** A function to reset to the initial state. */
  reset: () => void;
  /** A function to set the selected day. */
  setSelected: (day: Date | undefined) => void;
}

/** Return props and setters for binding an input field to DayPicker. */
export function useInput(options: UseInputOptions = {}): UseInputValue {
  const {
    locale = enUS,
    required,
    format = 'PP',
    defaultSelected,
    today = new Date()
  } = options;
  const { fromDate, toDate } = parseFromToProps(options);

  // Shortcut to the DateFns functions
  const parseValue = (value: string) => parse(value, format, today, { locale });

  // Initialize states
  const [month, setMonth] = useState(defaultSelected ?? today);
  const [selectedDay, setSelectedDay] = useState(defaultSelected);
  const defaultInputValue = defaultSelected
    ? _format(defaultSelected, format, { locale })
    : '';
  const [inputValue, setInputValue] = useState(defaultInputValue);

  const reset = () => {
    setSelectedDay(defaultSelected);
    setMonth(defaultSelected ?? today);
    setInputValue(defaultInputValue ?? '');
  };

  const setSelected = (date: Date | undefined) => {
    setSelectedDay(date);
    setMonth(date ?? today);
    setInputValue(date ? _format(date, format, { locale }) : '');
  };

  const handleDayClick: DayClickEventHandler = (day, { selected }) => {
    if (!required && selected) {
      setSelectedDay(undefined);
      setInputValue('');
      return;
    }
    setSelectedDay(day);
    setInputValue(day ? _format(day, format, { locale }) : '');
  };

  const handleMonthChange: MonthChangeEventHandler = (month) => {
    setMonth(month);
  };

  // When changing the input field, save its value in state and check if the
  // string is a valid date. If it is a valid day, set it as selected and update
  // the calendar’s month.
  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setInputValue(e.target.value);
    const day = parseValue(e.target.value);
    const isBefore = fromDate && differenceInCalendarDays(fromDate, day) > 0;
    const isAfter = toDate && differenceInCalendarDays(day, toDate) > 0;
    if (!isValidDate(day) || isBefore || isAfter) {
      setSelectedDay(undefined);
      return;
    }
    setSelectedDay(day);
    setMonth(day);
  };

  // Special case for _required_ fields: on blur, if the value of the input is not
  // a valid date, reset the calendar and the input value.
  const handleBlur: FocusEventHandler<HTMLInputElement> = (e) => {
    const day = parseValue(e.target.value);
    if (!isValidDate(day)) {
      reset();
    }
  };

  // When focusing, make sure DayPicker visualizes the month of the date in the
  // input field.
  const handleFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    if (!e.target.value) {
      reset();
      return;
    }
    const day = parseValue(e.target.value);
    if (isValidDate(day)) {
      setMonth(day);
    }
  };

  const dayPickerProps: InputDayPickerProps = {
    month: month,
    onDayClick: handleDayClick,
    onMonthChange: handleMonthChange,
    selected: selectedDay,
    locale,
    fromDate,
    toDate,
    today
  };

  const inputProps: InputProps = {
    onBlur: handleBlur,
    onChange: handleChange,
    onFocus: handleFocus,
    value: inputValue,
    placeholder: _format(new Date(), format, { locale })
  };

  return { dayPickerProps, inputProps, reset, setSelected };
}
