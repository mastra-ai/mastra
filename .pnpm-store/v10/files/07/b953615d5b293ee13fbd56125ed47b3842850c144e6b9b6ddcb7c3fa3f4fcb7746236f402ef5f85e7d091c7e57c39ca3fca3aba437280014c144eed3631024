import { Dispatch, SetStateAction, useState } from 'react';

export type DispatchStateAction<T> = Dispatch<SetStateAction<T>>;

/**
 * Helper hook for using controlled/uncontrolled values from a component props.
 *
 * When the value is not controlled, pass `undefined` as `controlledValue` and
 * use the returned setter to update it.
 *
 * When the value is controlled, pass the controlled value as second
 * argument, which will be always returned as `value`.
 */
export function useControlledValue<T>(
  defaultValue: T,
  controlledValue: T | undefined
): [T, DispatchStateAction<T>] {
  const [uncontrolledValue, setValue] = useState(defaultValue);

  const value =
    controlledValue === undefined ? uncontrolledValue : controlledValue;

  return [value, setValue] as [T, DispatchStateAction<T>];
}
