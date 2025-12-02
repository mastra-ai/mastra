import { createContext, ReactNode, useContext } from 'react';

import { isSameDay } from 'date-fns';

import { DayPickerBase } from 'types/DayPickerBase';
import {
  DayPickerMultipleProps,
  isDayPickerMultiple
} from 'types/DayPickerMultiple';
import { DayClickEventHandler } from 'types/EventHandlers';
import { InternalModifier, Modifiers } from 'types/Modifiers';

/** Represent the modifiers that are changed by the multiple selection. */
export type SelectMultipleModifiers = Pick<
  Modifiers,
  InternalModifier.Disabled
>;

/** Represents the value of a {@link SelectMultipleContext}. */
export interface SelectMultipleContextValue {
  /** The days that have been selected. */
  selected: Date[] | undefined;
  /** The modifiers for the corresponding selection. */
  modifiers: SelectMultipleModifiers;
  /** Event handler to attach to the day button to enable the multiple select. */
  onDayClick?: DayClickEventHandler;
}

/**
 * The SelectMultiple context shares details about the selected days when in
 * multiple selection mode.
 *
 * Access this context from the {@link useSelectMultiple} hook.
 */
export const SelectMultipleContext = createContext<
  SelectMultipleContextValue | undefined
>(undefined);

export type SelectMultipleProviderProps = {
  initialProps: DayPickerBase;
  children?: ReactNode;
};

/** Provides the values for the {@link SelectMultipleContext}. */
export function SelectMultipleProvider(
  props: SelectMultipleProviderProps
): JSX.Element {
  if (!isDayPickerMultiple(props.initialProps)) {
    const emptyContextValue: SelectMultipleContextValue = {
      selected: undefined,
      modifiers: {
        disabled: []
      }
    };
    return (
      <SelectMultipleContext.Provider value={emptyContextValue}>
        {props.children}
      </SelectMultipleContext.Provider>
    );
  }
  return (
    <SelectMultipleProviderInternal
      initialProps={props.initialProps}
      children={props.children}
    />
  );
}

/** @private */
export interface SelectMultipleProviderInternalProps {
  initialProps: DayPickerMultipleProps;
  children?: ReactNode;
}

export function SelectMultipleProviderInternal({
  initialProps,
  children
}: SelectMultipleProviderInternalProps): JSX.Element {
  const { selected, min, max } = initialProps;

  const onDayClick: DayClickEventHandler = (day, activeModifiers, e) => {
    initialProps.onDayClick?.(day, activeModifiers, e);

    const isMinSelected = Boolean(
      activeModifiers.selected && min && selected?.length === min
    );
    if (isMinSelected) {
      return;
    }

    const isMaxSelected = Boolean(
      !activeModifiers.selected && max && selected?.length === max
    );
    if (isMaxSelected) {
      return;
    }

    const selectedDays = selected ? [...selected] : [];

    if (activeModifiers.selected) {
      const index = selectedDays.findIndex((selectedDay) =>
        isSameDay(day, selectedDay)
      );
      selectedDays.splice(index, 1);
    } else {
      selectedDays.push(day);
    }
    initialProps.onSelect?.(selectedDays, day, activeModifiers, e);
  };

  const modifiers: SelectMultipleModifiers = {
    disabled: []
  };

  if (selected) {
    modifiers.disabled.push((day: Date) => {
      const isMaxSelected = max && selected.length > max - 1;
      const isSelected = selected.some((selectedDay) =>
        isSameDay(selectedDay, day)
      );
      return Boolean(isMaxSelected && !isSelected);
    });
  }

  const contextValue = {
    selected,
    onDayClick,
    modifiers
  };

  return (
    <SelectMultipleContext.Provider value={contextValue}>
      {children}
    </SelectMultipleContext.Provider>
  );
}

/**
 * Hook to access the {@link SelectMultipleContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
export function useSelectMultiple(): SelectMultipleContextValue {
  const context = useContext(SelectMultipleContext);
  if (!context) {
    throw new Error(
      'useSelectMultiple must be used within a SelectMultipleProvider'
    );
  }
  return context;
}
