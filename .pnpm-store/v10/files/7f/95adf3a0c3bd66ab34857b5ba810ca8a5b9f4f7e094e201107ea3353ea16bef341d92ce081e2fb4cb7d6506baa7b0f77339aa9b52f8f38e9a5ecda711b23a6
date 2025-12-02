import type { Context } from 'react'
import type { Action, Dispatch, UnknownAction } from 'redux'

import type { ReactReduxContextValue } from '../components/Context'
import { ReactReduxContext } from '../components/Context'
import { createStoreHook, useStore as useDefaultStore } from './useStore'

/**
 * Represents a custom hook that provides a dispatch function
 * from the Redux store.
 *
 * @template DispatchType - The specific type of the dispatch function.
 *
 * @since 9.1.0
 * @public
 */
export interface UseDispatch<
  DispatchType extends Dispatch<UnknownAction> = Dispatch<UnknownAction>,
> {
  /**
   * Returns the dispatch function from the Redux store.
   *
   * @returns The dispatch function from the Redux store.
   *
   * @template AppDispatch - The specific type of the dispatch function.
   */
  <AppDispatch extends DispatchType = DispatchType>(): AppDispatch

  /**
   * Creates a "pre-typed" version of {@linkcode useDispatch useDispatch}
   * where the type of the `dispatch` function is predefined.
   *
   * This allows you to set the `dispatch` type once, eliminating the need to
   * specify it with every {@linkcode useDispatch useDispatch} call.
   *
   * @returns A pre-typed `useDispatch` with the dispatch type already defined.
   *
   * @example
   * ```ts
   * export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
   * ```
   *
   * @template OverrideDispatchType - The specific type of the dispatch function.
   *
   * @since 9.1.0
   */
  withTypes: <
    OverrideDispatchType extends DispatchType,
  >() => UseDispatch<OverrideDispatchType>
}

/**
 * Hook factory, which creates a `useDispatch` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useDispatch` hook bound to the specified context.
 */
export function createDispatchHook<
  StateType = unknown,
  ActionType extends Action = UnknownAction,
>(
  // @ts-ignore
  context?: Context<ReactReduxContextValue<
    StateType,
    ActionType
  > | null> = ReactReduxContext,
) {
  const useStore =
    context === ReactReduxContext ? useDefaultStore : createStoreHook(context)

  const useDispatch = () => {
    const store = useStore()
    return store.dispatch
  }

  Object.assign(useDispatch, {
    withTypes: () => useDispatch,
  })

  return useDispatch as UseDispatch<Dispatch<ActionType>>
}

/**
 * A hook to access the redux `dispatch` function.
 *
 * @returns {any|function} redux store's `dispatch` function
 *
 * @example
 *
 * import React, { useCallback } from 'react'
 * import { useDispatch } from 'react-redux'
 *
 * export const CounterComponent = ({ value }) => {
 *   const dispatch = useDispatch()
 *   const increaseCounter = useCallback(() => dispatch({ type: 'increase-counter' }), [])
 *   return (
 *     <div>
 *       <span>{value}</span>
 *       <button onClick={increaseCounter}>Increase counter</button>
 *     </div>
 *   )
 * }
 */
export const useDispatch = /*#__PURE__*/ createDispatchHook()
