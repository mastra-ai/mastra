import type { Context, ReactNode } from 'react'
import { React } from '../utils/react'
import type { Action, Store, UnknownAction } from 'redux'
import type { DevModeCheckFrequency } from '../hooks/useSelector'
import { createSubscription } from '../utils/Subscription'
import { useIsomorphicLayoutEffect } from '../utils/useIsomorphicLayoutEffect'
import type { ReactReduxContextValue } from './Context'
import { ReactReduxContext } from './Context'

export interface ProviderProps<
  A extends Action<string> = UnknownAction,
  S = unknown,
> {
  /**
   * The single Redux store in your application.
   */
  store: Store<S, A>

  /**
   * An optional server state snapshot. Will be used during initial hydration render if available, to ensure that the UI output is consistent with the HTML generated on the server.
   */
  serverState?: S

  /**
   * Optional context to be used internally in react-redux. Use React.createContext() to create a context to be used.
   * If this is used, you'll need to customize `connect` by supplying the same context provided to the Provider.
   * Set the initial value to null, and the hooks will error
   * if this is not overwritten by Provider.
   */
  context?: Context<ReactReduxContextValue<S, A> | null>

  /**
   * Determines the frequency of stability checks for all selectors.
   * This setting overrides the global configuration for
   * the `useSelector` stability check, allowing you to specify how often
   * these checks should occur in development mode.
   *
   * @since 8.1.0
   */
  stabilityCheck?: DevModeCheckFrequency

  /**
   * Determines the frequency of identity function checks for all selectors.
   * This setting overrides the global configuration for
   * the `useSelector` identity function check, allowing you to specify how often
   * these checks should occur in development mode.
   *
   * **Note**: Previously referred to as `noopCheck`.
   *
   * @since 9.0.0
   */
  identityFunctionCheck?: DevModeCheckFrequency

  children: ReactNode
}

function Provider<A extends Action<string> = UnknownAction, S = unknown>(
  providerProps: ProviderProps<A, S>,
) {
  const { children, context, serverState, store } = providerProps

  const contextValue = React.useMemo(() => {
    const subscription = createSubscription(store)

    const baseContextValue = {
      store,
      subscription,
      getServerState: serverState ? () => serverState : undefined,
    }

    if (process.env.NODE_ENV === 'production') {
      return baseContextValue
    } else {
      const { identityFunctionCheck = 'once', stabilityCheck = 'once' } =
        providerProps

      return /* @__PURE__ */ Object.assign(baseContextValue, {
        stabilityCheck,
        identityFunctionCheck,
      })
    }
  }, [store, serverState])

  const previousState = React.useMemo(() => store.getState(), [store])

  useIsomorphicLayoutEffect(() => {
    const { subscription } = contextValue
    subscription.onStateChange = subscription.notifyNestedSubs
    subscription.trySubscribe()

    if (previousState !== store.getState()) {
      subscription.notifyNestedSubs()
    }
    return () => {
      subscription.tryUnsubscribe()
      subscription.onStateChange = undefined
    }
  }, [contextValue, previousState])

  const Context = context || ReactReduxContext

  return <Context.Provider value={contextValue}>{children}</Context.Provider>
}

export default Provider
