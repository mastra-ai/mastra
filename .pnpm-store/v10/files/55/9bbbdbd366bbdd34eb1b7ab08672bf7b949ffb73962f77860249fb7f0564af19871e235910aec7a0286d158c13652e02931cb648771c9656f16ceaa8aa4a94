import { createContext, ReactNode, useContext } from 'react';

import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  subDays
} from 'date-fns';

import { DayPickerBase } from 'types/DayPickerBase';
import { DayPickerRangeProps, isDayPickerRange } from 'types/DayPickerRange';
import { DayClickEventHandler } from 'types/EventHandlers';
import { DateRange } from 'types/Matchers';
import { InternalModifier, Modifiers } from 'types/Modifiers';

import { addToRange } from './utils/addToRange';

/** Represent the modifiers that are changed by the range selection. */
export type SelectRangeModifiers = Pick<
  Modifiers,
  | InternalModifier.Disabled
  | InternalModifier.RangeEnd
  | InternalModifier.RangeMiddle
  | InternalModifier.RangeStart
>;

/** Represents the value of a {@link SelectRangeContext}. */
export interface SelectRangeContextValue {
  /** The range of days that has been selected. */
  selected: DateRange | undefined;
  /** The modifiers for the corresponding selection. */
  modifiers: SelectRangeModifiers;
  /** Event handler to attach to the day button to enable the range select. */
  onDayClick?: DayClickEventHandler;
}

/**
 * The SelectRange context shares details about the selected days when in
 * range selection mode.
 *
 * Access this context from the {@link useSelectRange} hook.
 */
export const SelectRangeContext = createContext<
  SelectRangeContextValue | undefined
>(undefined);

export interface SelectRangeProviderProps {
  initialProps: DayPickerBase;
  children?: ReactNode;
}

/** Provides the values for the {@link SelectRangeProvider}. */
export function SelectRangeProvider(
  props: SelectRangeProviderProps
): JSX.Element {
  if (!isDayPickerRange(props.initialProps)) {
    const emptyContextValue: SelectRangeContextValue = {
      selected: undefined,
      modifiers: {
        range_start: [],
        range_end: [],
        range_middle: [],
        disabled: []
      }
    };
    return (
      <SelectRangeContext.Provider value={emptyContextValue}>
        {props.children}
      </SelectRangeContext.Provider>
    );
  }
  return (
    <SelectRangeProviderInternal
      initialProps={props.initialProps}
      children={props.children}
    />
  );
}

/** @private */
export interface SelectRangeProviderInternalProps {
  initialProps: DayPickerRangeProps;
  children?: ReactNode;
}

export function SelectRangeProviderInternal({
  initialProps,
  children
}: SelectRangeProviderInternalProps): JSX.Element {
  const { selected } = initialProps;
  const { from: selectedFrom, to: selectedTo } = selected || {};
  const min = initialProps.min;
  const max = initialProps.max;

  const onDayClick: DayClickEventHandler = (day, activeModifiers, e) => {
    initialProps.onDayClick?.(day, activeModifiers, e);
    const newRange = addToRange(day, selected);
    initialProps.onSelect?.(newRange, day, activeModifiers, e);
  };

  const modifiers: SelectRangeModifiers = {
    range_start: [],
    range_end: [],
    range_middle: [],
    disabled: []
  };

  if (selectedFrom) {
    modifiers.range_start = [selectedFrom];
    if (!selectedTo) {
      modifiers.range_end = [selectedFrom];
    } else {
      modifiers.range_end = [selectedTo];
      if (!isSameDay(selectedFrom, selectedTo)) {
        modifiers.range_middle = [
          {
            after: selectedFrom,
            before: selectedTo
          }
        ];
      }
    }
  } else if (selectedTo) {
    modifiers.range_start = [selectedTo];
    modifiers.range_end = [selectedTo];
  }

  if (min) {
    if (selectedFrom && !selectedTo) {
      modifiers.disabled.push({
        after: subDays(selectedFrom, min - 1),
        before: addDays(selectedFrom, min - 1)
      });
    }
    if (selectedFrom && selectedTo) {
      modifiers.disabled.push({
        after: selectedFrom,
        before: addDays(selectedFrom, min - 1)
      });
    }
    if (!selectedFrom && selectedTo) {
      modifiers.disabled.push({
        after: subDays(selectedTo, min - 1),
        before: addDays(selectedTo, min - 1)
      });
    }
  }
  if (max) {
    if (selectedFrom && !selectedTo) {
      modifiers.disabled.push({
        before: addDays(selectedFrom, -max + 1)
      });
      modifiers.disabled.push({
        after: addDays(selectedFrom, max - 1)
      });
    }
    if (selectedFrom && selectedTo) {
      const selectedCount =
        differenceInCalendarDays(selectedTo, selectedFrom) + 1;
      const offset = max - selectedCount;
      modifiers.disabled.push({
        before: subDays(selectedFrom, offset)
      });
      modifiers.disabled.push({
        after: addDays(selectedTo, offset)
      });
    }
    if (!selectedFrom && selectedTo) {
      modifiers.disabled.push({
        before: addDays(selectedTo, -max + 1)
      });
      modifiers.disabled.push({
        after: addDays(selectedTo, max - 1)
      });
    }
  }

  return (
    <SelectRangeContext.Provider value={{ selected, onDayClick, modifiers }}>
      {children}
    </SelectRangeContext.Provider>
  );
}

/**
 * Hook to access the {@link SelectRangeContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
export function useSelectRange(): SelectRangeContextValue {
  const context = useContext(SelectRangeContext);
  if (!context) {
    throw new Error('useSelectRange must be used within a SelectRangeProvider');
  }
  return context;
}
