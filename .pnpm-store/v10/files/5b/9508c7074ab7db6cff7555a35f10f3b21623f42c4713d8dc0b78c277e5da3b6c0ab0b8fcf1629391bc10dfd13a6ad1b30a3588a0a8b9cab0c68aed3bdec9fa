import { type Dispatch, type SetStateAction } from 'react';
export interface CallOptions {
    /**
     * Controls if the function should be invoked on the leading edge of the timeout.
     */
    leading?: boolean;
    /**
     * Controls if the function should be invoked on the trailing edge of the timeout.
     */
    trailing?: boolean;
}
export interface Options extends CallOptions {
    /**
     * The maximum time the given function is allowed to be delayed before it's invoked.
     */
    maxWait?: number;
    /**
     * If the setting is set to true, all debouncing and timers will happen on the server side as well
     */
    debounceOnServer?: boolean;
}
export interface ControlFunctions<ReturnT> {
    /**
     * Cancel pending function invocations
     */
    cancel: () => void;
    /**
     * Immediately invoke pending function invocations
     */
    flush: () => ReturnT | undefined;
    /**
     * Returns `true` if there are any pending function invocations
     */
    isPending: () => boolean;
}
/**
 * Subsequent calls to the debounced function return the result of the last func invocation.
 * Note, that if there are no previous invocations you will get undefined. You should check it in your code properly.
 */
export interface DebouncedState<T extends (...args: any) => ReturnType<T>> extends ControlFunctions<ReturnType<T>> {
    (...args: Parameters<T>): ReturnType<T> | undefined;
}
/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked, or until the next browser frame is drawn.
 *
 * The debounced function comes with a `cancel` method to cancel delayed `func`
 * invocations and a `flush` method to immediately invoke them.
 *
 * Provide `options` to indicate whether `func` should be invoked on the leading
 * and/or trailing edge of the `wait` timeout. The `func` is invoked with the
 * last arguments provided to the debounced function.
 *
 * Subsequent calls to the debounced function return the result of the last
 * `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the debounced function
 * is invoked more than once during the `wait` timeout.
 *
 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
 * until the next tick, similar to `setTimeout` with a timeout of `0`.
 *
 * If `wait` is omitted in an environment with `requestAnimationFrame`, `func`
 * invocation will be deferred until the next frame is drawn (typically about
 * 16ms).
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `debounce` and `throttle`.
 *
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0]
 *  The number of milliseconds to delay; if omitted, `requestAnimationFrame` is
 *  used (if available, otherwise it will be setTimeout(...,0)).
 * @param {Object} [options={}] The options object.
 *  Controls if `func` should be invoked on the leading edge of the timeout.
 * @param {boolean} [options.leading=false]
 *  The maximum time `func` is allowed to be delayed before it's invoked.
 * @param {number} [options.maxWait]
 *  Controls if `func` should be invoked the trailing edge of the timeout.
 * @param {boolean} [options.trailing=true]
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * const resizeHandler = useDebouncedCallback(calculateLayout, 150);
 * window.addEventListener('resize', resizeHandler)
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * const clickHandler = useDebouncedCallback(sendMail, 300, {
 *   leading: true,
 *   trailing: false,
 * })
 * <button onClick={clickHandler}>click me</button>
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * const debounced = useDebouncedCallback(batchLog, 250, { 'maxWait': 1000 })
 * const source = new EventSource('/stream')
 * source.addEventListener('message', debounced)
 *
 * // Cancel the trailing debounced invocation.
 * window.addEventListener('popstate', debounced.cancel)
 *
 * // Check for pending invocations.
 * const status = debounced.isPending() ? "Pending..." : "Ready"
 */
export default function useDebouncedCallback<T extends (...args: any) => ReturnType<T>>(func: T, wait?: number, options?: Options, forceUpdate?: Dispatch<SetStateAction<object>>): DebouncedState<T>;
