import type { StoreValues } from '../computed/index.d.ts'
import type { AnyStore, Store, StoreValue } from '../index.js'

interface Effect {
  <OriginStore extends Store>(
    stores: OriginStore,
    cb: (value: StoreValue<OriginStore>) => void | VoidFunction
  ): VoidFunction
  /**
   * Subscribe for multiple stores. Also you can define cleanup function
   * to call on stores changes.
   *
   * ```js
   * const $enabled = atom(true)
   * const $interval = atom(1000)
   *
   * const cancelPing = effect([$enabled, $interval], (enabled, interval) => {
   *   if (!enabled) return
   *   const intervalId = setInterval(() => {
   *     sendPing()
   *   }, interval)
   *   return () => {
   *     clearInterval(intervalId)
   *   }
   * })
   * ```
   */
  <OriginStores extends AnyStore[]>(
    stores: [...OriginStores],
    cb: (...values: StoreValues<OriginStores>) => void | VoidFunction
  ): VoidFunction
}

export const effect: Effect
