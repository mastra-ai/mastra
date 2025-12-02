import type { WritableAtom } from '../atom/index.js'
import type { AnyStore } from '../map/index.js'
import type {
  AllPaths,
  BaseDeepMap,
  FromPath,
  FromPathWithIndexSignatureUndefined
} from './path.js'

export {
  AllPaths,
  BaseDeepMap,
  FromPath,
  getPath,
  setByKey,
  setPath
} from './path.js'

export type DeepMapStore<T extends BaseDeepMap> = {
  /**
   * Subscribe to store changes.
   *
   * In contrast with {@link Store#subscribe} it do not call listener
   * immediately.
   *
   * @param listener Callback with store value and old value.
   * @param changedKey Key that was changed. Will present only if `setKey`
   *                   has been used to change a store.
   * @returns Function to remove listener.
   */
  listen(
    listener: (
      value: T,
      oldValue: T,
      changedKey: AllPaths<T> | undefined
    ) => void
  ): () => void

  /**
   * Low-level method to notify listeners about changes in the store.
   *
   * Can cause unexpected behaviour when combined with frontend frameworks
   * doing equality checks for values, e.g. React.
   */
  notify(oldValue?: T, changedKey?: AllPaths<T>): void

  /**
   * Change key in store value. Copies are made at each level of `key` so that
   * no part of the original object is mutated (but it does not do a full deep
   * copy -- some sub-objects may still be shared between the old value and the
   * new one).
   *
   * ```js
   * $settings.setKey('visuals.theme', 'dark')
   * ```
   *
   * @param key The key name. Attributes can be split with a dot `.` and `[]`.
   * @param value New value.
   */
  setKey: <K extends AllPaths<T>>(
    key: K,
    value: FromPathWithIndexSignatureUndefined<T, K>
  ) => void

  /**
   * Subscribe to store changes and call listener immediately.
   *
   * ```
   * import { $settings } from '../store'
   *
   * $settings.subscribe(settings => {
   *   console.log(settings)
   * })
   * ```
   *
   * @param listener Callback with store value and old value.
   * @param changedKey Key that was changed. Will present only
   *                   if `setKey` has been used to change a store.
   * @returns Function to remove listener.
   */
  subscribe(
    listener: (
      value: T,
      oldValue: T | undefined,
      changedKey: AllPaths<T> | undefined
    ) => void
  ): () => void
} & Omit<WritableAtom<T>, 'listen' | 'notify' | 'setKey' | 'subscribe'>

/**
 * Create deep map store. Deep map store is a store with an object as store
 * value, that supports fine-grained reactivity for deeply nested properties.
 *
 * @param init Initialize store and return store destructor.
 * @returns The store object with methods to subscribe.
 *
 * @deprecated Use `@nanostores/deepmap`.
 */
export function deepMap<T extends BaseDeepMap>(init?: T): DeepMapStore<T>

/**
 * Get a value by key from a store with an object value.
 * Works with `map`, `deepMap`, and `atom`.
 *
 * ```js
 * import { getKey, map } from 'nanostores'
 *
 * const $user = map({ name: 'John', profile: { age: 30 } })
 *
 * // Simple key access
 * getKey($user, 'name') // Returns 'John'
 *
 * // Nested access with dot notation
 * getKey($user, 'profile.age') // Returns 30
 *
 * // Array access
 * const $items = map({ products: ['apple', 'banana'] })
 * getKey($items, 'products[1]') // Returns 'banana'
 * ```
 *
 * @param store The store to get the value from.
 * @param key The key to access. Can be a simple key or a path with dot notation.
 * @returns The value for this key
 */

/**
 * @deprecated Use `@nanostores/deepmap`.
 */
export function getKey<
  T extends Record<string, unknown>,
  K extends AllPaths<T>
>(store: AnyStore<T>, key: K): FromPath<T, K>
