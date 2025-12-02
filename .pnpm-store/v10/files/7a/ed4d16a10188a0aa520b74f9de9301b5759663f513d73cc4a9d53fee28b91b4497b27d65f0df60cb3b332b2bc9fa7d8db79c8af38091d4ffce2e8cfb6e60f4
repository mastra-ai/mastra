//import * as React from 'react'
import { React } from '../utils/react'
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector.js'
import type { ReactReduxContextValue } from '../components/Context'
import { ReactReduxContext } from '../components/Context'
import type { EqualityFn, NoInfer } from '../types'
import {
  createReduxContextHook,
  useReduxContext as useDefaultReduxContext,
} from './useReduxContext'

/**
 * The frequency of development mode checks.
 *
 * @since 8.1.0
 * @internal
 */
export type DevModeCheckFrequency = 'never' | 'once' | 'always'

/**
 * Represents the configuration for development mode checks.
 *
 * @since 9.0.0
 * @internal
 */
export interface DevModeChecks {
  /**
   * Overrides the global stability check for the selector.
   * - `once` - Run only the first time the selector is called.
   * - `always` - Run every time the selector is called.
   * - `never` - Never run the stability check.
   *
   * @default 'once'
   *
   * @since 8.1.0
   */
  stabilityCheck: DevModeCheckFrequency

  /**
   * Overrides the global identity function check for the selector.
   * - `once` - Run only the first time the selector is called.
   * - `always` - Run every time the selector is called.
   * - `never` - Never run the identity function check.
   *
   * **Note**: Previously referred to as `noopCheck`.
   *
   * @default 'once'
   *
   * @since 9.0.0
   */
  identityFunctionCheck: DevModeCheckFrequency
}

export interface UseSelectorOptions<Selected = unknown> {
  equalityFn?: EqualityFn<Selected>

  /**
   * `useSelector` performs additional checks in development mode to help
   * identify and warn about potential issues in selector behavior. This
   * option allows you to customize the behavior of these checks per selector.
   *
   * @since 9.0.0
   */
  devModeChecks?: Partial<DevModeChecks>
}

/**
 * Represents a custom hook that allows you to extract data from the
 * Redux store state, using a selector function. The selector function
 * takes the current state as an argument and returns a part of the state
 * or some derived data. The hook also supports an optional equality
 * function or options object to customize its behavior.
 *
 * @template StateType - The specific type of state this hook operates on.
 *
 * @public
 */
export interface UseSelector<StateType = unknown> {
  /**
   * A function that takes a selector function as its first argument.
   * The selector function is responsible for selecting a part of
   * the Redux store's state or computing derived data.
   *
   * @param selector - A function that receives the current state and returns a part of the state or some derived data.
   * @param equalityFnOrOptions - An optional equality function or options object for customizing the behavior of the selector.
   * @returns The selected part of the state or derived data.
   *
   * @template TState - The specific type of state this hook operates on.
   * @template Selected - The type of the value that the selector function will return.
   */
  <TState extends StateType = StateType, Selected = unknown>(
    selector: (state: TState) => Selected,
    equalityFnOrOptions?: EqualityFn<Selected> | UseSelectorOptions<Selected>,
  ): Selected

  /**
   * Creates a "pre-typed" version of {@linkcode useSelector useSelector}
   * where the `state` type is predefined.
   *
   * This allows you to set the `state` type once, eliminating the need to
   * specify it with every {@linkcode useSelector useSelector} call.
   *
   * @returns A pre-typed `useSelector` with the state type already defined.
   *
   * @example
   * ```ts
   * export const useAppSelector = useSelector.withTypes<RootState>()
   * ```
   *
   * @template OverrideStateType - The specific type of state this hook operates on.
   *
   * @since 9.1.0
   */
  withTypes: <
    OverrideStateType extends StateType,
  >() => UseSelector<OverrideStateType>
}

const refEquality: EqualityFn<any> = (a, b) => a === b

/**
 * Hook factory, which creates a `useSelector` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useSelector` hook bound to the specified context.
 */
export function createSelectorHook(
  context: React.Context<ReactReduxContextValue<
    any,
    any
  > | null> = ReactReduxContext,
): UseSelector {
  const useReduxContext =
    context === ReactReduxContext
      ? useDefaultReduxContext
      : createReduxContextHook(context)

  const useSelector = <TState, Selected>(
    selector: (state: TState) => Selected,
    equalityFnOrOptions:
      | EqualityFn<NoInfer<Selected>>
      | UseSelectorOptions<NoInfer<Selected>> = {},
  ): Selected => {
    const { equalityFn = refEquality } =
      typeof equalityFnOrOptions === 'function'
        ? { equalityFn: equalityFnOrOptions }
        : equalityFnOrOptions
    if (process.env.NODE_ENV !== 'production') {
      if (!selector) {
        throw new Error(`You must pass a selector to useSelector`)
      }
      if (typeof selector !== 'function') {
        throw new Error(`You must pass a function as a selector to useSelector`)
      }
      if (typeof equalityFn !== 'function') {
        throw new Error(
          `You must pass a function as an equality function to useSelector`,
        )
      }
    }

    const reduxContext = useReduxContext()

    const { store, subscription, getServerState } = reduxContext

    const firstRun = React.useRef(true)

    const wrappedSelector = React.useCallback<typeof selector>(
      {
        [selector.name](state: TState) {
          const selected = selector(state)
          if (process.env.NODE_ENV !== 'production') {
            const { devModeChecks = {} } =
              typeof equalityFnOrOptions === 'function'
                ? {}
                : equalityFnOrOptions
            const { identityFunctionCheck, stabilityCheck } = reduxContext
            const {
              identityFunctionCheck: finalIdentityFunctionCheck,
              stabilityCheck: finalStabilityCheck,
            } = {
              stabilityCheck,
              identityFunctionCheck,
              ...devModeChecks,
            }
            if (
              finalStabilityCheck === 'always' ||
              (finalStabilityCheck === 'once' && firstRun.current)
            ) {
              const toCompare = selector(state)
              if (!equalityFn(selected, toCompare)) {
                let stack: string | undefined = undefined
                try {
                  throw new Error()
                } catch (e) {
                  // eslint-disable-next-line no-extra-semi
                  ;({ stack } = e as Error)
                }
                console.warn(
                  'Selector ' +
                    (selector.name || 'unknown') +
                    ' returned a different result when called with the same parameters. This can lead to unnecessary rerenders.' +
                    '\nSelectors that return a new reference (such as an object or an array) should be memoized: https://redux.js.org/usage/deriving-data-selectors#optimizing-selectors-with-memoization',
                  {
                    state,
                    selected,
                    selected2: toCompare,
                    stack,
                  },
                )
              }
            }
            if (
              finalIdentityFunctionCheck === 'always' ||
              (finalIdentityFunctionCheck === 'once' && firstRun.current)
            ) {
              // @ts-ignore
              if (selected === state) {
                let stack: string | undefined = undefined
                try {
                  throw new Error()
                } catch (e) {
                  // eslint-disable-next-line no-extra-semi
                  ;({ stack } = e as Error)
                }
                console.warn(
                  'Selector ' +
                    (selector.name || 'unknown') +
                    ' returned the root state when called. This can lead to unnecessary rerenders.' +
                    '\nSelectors that return the entire state are almost certainly a mistake, as they will cause a rerender whenever *anything* in state changes.',
                  { stack },
                )
              }
            }
            if (firstRun.current) firstRun.current = false
          }
          return selected
        },
      }[selector.name],
      [selector],
    )

    const selectedState = useSyncExternalStoreWithSelector(
      subscription.addNestedSub,
      store.getState,
      getServerState || store.getState,
      wrappedSelector,
      equalityFn,
    )

    React.useDebugValue(selectedState)

    return selectedState
  }

  Object.assign(useSelector, {
    withTypes: () => useSelector,
  })

  return useSelector as UseSelector
}

/**
 * A hook to access the redux store's state. This hook takes a selector function
 * as an argument. The selector is called with the store state.
 *
 * This hook takes an optional equality comparison function as the second parameter
 * that allows you to customize the way the selected state is compared to determine
 * whether the component needs to be re-rendered.
 *
 * @param {Function} selector the selector function
 * @param {Function=} equalityFn the function that will be used to determine equality
 *
 * @returns {any} the selected state
 *
 * @example
 *
 * import React from 'react'
 * import { useSelector } from 'react-redux'
 *
 * export const CounterComponent = () => {
 *   const counter = useSelector(state => state.counter)
 *   return <div>{counter}</div>
 * }
 */
export const useSelector = /*#__PURE__*/ createSelectorHook()
