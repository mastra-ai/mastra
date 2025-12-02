import type { Context } from 'react'
import type { Action, Store } from 'redux'
import type { ReactReduxContextValue } from '../components/Context'
import { ReactReduxContext } from '../components/Context'
import {
  createReduxContextHook,
  useReduxContext as useDefaultReduxContext,
} from './useReduxContext'

/**
 * Represents a type that extracts the action type from a given Redux store.
 *
 * @template StoreType - The specific type of the Redux store.
 *
 * @since 9.1.0
 * @internal
 */
export type ExtractStoreActionType<StoreType extends Store> =
  StoreType extends Store<any, infer ActionType> ? ActionType : never

/**
 * Represents a custom hook that provides access to the Redux store.
 *
 * @template StoreType - The specific type of the Redux store that gets returned.
 *
 * @since 9.1.0
 * @public
 */
export interface UseStore<StoreType extends Store> {
  /**
   * Returns the Redux store instance.
   *
   * @returns The Redux store instance.
   */
  (): StoreType

  /**
   * Returns the Redux store instance with specific state and action types.
   *
   * @returns The Redux store with the specified state and action types.
   *
   * @template StateType - The specific type of the state used in the store.
   * @template ActionType - The specific type of the actions used in the store.
   */
  <
    StateType extends ReturnType<StoreType['getState']> = ReturnType<
      StoreType['getState']
    >,
    ActionType extends Action = ExtractStoreActionType<Store>,
  >(): Store<StateType, ActionType>

  /**
   * Creates a "pre-typed" version of {@linkcode useStore useStore}
   * where the type of the Redux `store` is predefined.
   *
   * This allows you to set the `store` type once, eliminating the need to
   * specify it with every {@linkcode useStore useStore} call.
   *
   * @returns A pre-typed `useStore` with the store type already defined.
   *
   * @example
   * ```ts
   * export const useAppStore = useStore.withTypes<AppStore>()
   * ```
   *
   * @template OverrideStoreType - The specific type of the Redux store that gets returned.
   *
   * @since 9.1.0
   */
  withTypes: <
    OverrideStoreType extends StoreType,
  >() => UseStore<OverrideStoreType>
}

/**
 * Hook factory, which creates a `useStore` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useStore` hook bound to the specified context.
 */
export function createStoreHook<
  StateType = unknown,
  ActionType extends Action = Action,
>(
  // @ts-ignore
  context?: Context<ReactReduxContextValue<
    StateType,
    ActionType
  > | null> = ReactReduxContext,
) {
  const useReduxContext =
    context === ReactReduxContext
      ? useDefaultReduxContext
      : // @ts-ignore
        createReduxContextHook(context)
  const useStore = () => {
    const { store } = useReduxContext()
    return store
  }

  Object.assign(useStore, {
    withTypes: () => useStore,
  })

  return useStore as UseStore<Store<StateType, ActionType>>
}

/**
 * A hook to access the redux store.
 *
 * @returns {any} the redux store
 *
 * @example
 *
 * import React from 'react'
 * import { useStore } from 'react-redux'
 *
 * export const ExampleComponent = () => {
 *   const store = useStore()
 *   return <div>{store.getState()}</div>
 * }
 */
export const useStore = /*#__PURE__*/ createStoreHook()
