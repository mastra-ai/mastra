import { createContext, ReactNode, useContext } from 'react';

import { DayPickerBase } from 'types/DayPickerBase';
import { DayPickerSingleProps, isDayPickerSingle } from 'types/DayPickerSingle';
import { DayClickEventHandler } from 'types/EventHandlers';

/** Represents the value of a {@link SelectSingleContext}. */
export interface SelectSingleContextValue {
  /** The day that has been selected. */
  selected: Date | undefined;
  /** Event handler to attach to the day button to enable the single select. */
  onDayClick?: DayClickEventHandler;
}

/**
 * The SelectSingle context shares details about the selected days when in
 * single selection mode.
 *
 * Access this context from the {@link useSelectSingle} hook.
 */
export const SelectSingleContext = createContext<
  SelectSingleContextValue | undefined
>(undefined);

export interface SelectSingleProviderProps {
  initialProps: DayPickerBase;
  children?: ReactNode;
}

/** Provides the values for the {@link SelectSingleProvider}. */
export function SelectSingleProvider(
  props: SelectSingleProviderProps
): JSX.Element {
  if (!isDayPickerSingle(props.initialProps)) {
    const emptyContextValue: SelectSingleContextValue = {
      selected: undefined
    };
    return (
      <SelectSingleContext.Provider value={emptyContextValue}>
        {props.children}
      </SelectSingleContext.Provider>
    );
  }
  return (
    <SelectSingleProviderInternal
      initialProps={props.initialProps}
      children={props.children}
    />
  );
}

/** @private */
export interface SelectSingleProviderInternal {
  initialProps: DayPickerSingleProps;
  children?: ReactNode;
}

export function SelectSingleProviderInternal({
  initialProps,
  children
}: SelectSingleProviderInternal): JSX.Element {
  const onDayClick: DayClickEventHandler = (day, activeModifiers, e) => {
    initialProps.onDayClick?.(day, activeModifiers, e);

    if (activeModifiers.selected && !initialProps.required) {
      initialProps.onSelect?.(undefined, day, activeModifiers, e);
      return;
    }
    initialProps.onSelect?.(day, day, activeModifiers, e);
  };

  const contextValue: SelectSingleContextValue = {
    selected: initialProps.selected,
    onDayClick
  };
  return (
    <SelectSingleContext.Provider value={contextValue}>
      {children}
    </SelectSingleContext.Provider>
  );
}

/**
 * Hook to access the {@link SelectSingleContextValue}.
 *
 * This hook is meant to be used inside internal or custom components.
 */
export function useSelectSingle(): SelectSingleContextValue {
  const context = useContext(SelectSingleContext);
  if (!context) {
    throw new Error(
      'useSelectSingle must be used within a SelectSingleProvider'
    );
  }
  return context;
}
