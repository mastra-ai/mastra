import connect from './components/connect'
export type {
  Connect,
  ConnectProps,
  ConnectedProps,
} from './components/connect'

import shallowEqual from './utils/shallowEqual'

import Provider from './components/Provider'
import { defaultNoopBatch } from './utils/batch'

export { ReactReduxContext } from './components/Context'
export type { ReactReduxContextValue } from './components/Context'

export type { ProviderProps } from './components/Provider'

export type {
  MapDispatchToProps,
  MapDispatchToPropsFactory,
  MapDispatchToPropsFunction,
  MapDispatchToPropsNonObject,
  MapDispatchToPropsParam,
  MapStateToProps,
  MapStateToPropsFactory,
  MapStateToPropsParam,
  MergeProps,
  Selector,
  SelectorFactory,
} from './connect/selectorFactory'

export { createDispatchHook, useDispatch } from './hooks/useDispatch'
export type { UseDispatch } from './hooks/useDispatch'

export { createSelectorHook, useSelector } from './hooks/useSelector'
export type { UseSelector } from './hooks/useSelector'

export { createStoreHook, useStore } from './hooks/useStore'
export type { UseStore } from './hooks/useStore'

export type { Subscription } from './utils/Subscription'

export * from './types'

/**
 * @deprecated As of React 18, batching is enabled by default for ReactDOM and React Native.
 * This is now a no-op that immediately runs the callback.
 */
const batch = defaultNoopBatch

export { Provider, batch, connect, shallowEqual }
