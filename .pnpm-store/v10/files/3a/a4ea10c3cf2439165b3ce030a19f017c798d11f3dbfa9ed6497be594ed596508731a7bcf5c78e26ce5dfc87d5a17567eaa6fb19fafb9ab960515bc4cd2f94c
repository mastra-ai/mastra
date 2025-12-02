import { CallOptions, DebouncedState } from './useDebouncedCallback';
/**
 * Creates a throttled function that only invokes `func` at most once per
 * every `wait` milliseconds (or once per browser frame).
 *
 * The throttled function comes with a `cancel` method to cancel delayed `func`
 * invocations and a `flush` method to immediately invoke them.
 *
 * Provide `options` to indicate whether `func` should be invoked on the leading
 * and/or trailing edge of the `wait` timeout. The `func` is invoked with the
 * last arguments provided to the throttled function.
 *
 * Subsequent calls to the throttled function return the result of the last
 * `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the throttled function
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
 * for details over the differences between `throttle` and `debounce`.
 *
 * @category Function
 * @param {Function} func The function to throttle.
 * @param {number} [wait=0]
 *  The number of milliseconds to throttle invocations to; if omitted,
 *  `requestAnimationFrame` is used (if available, otherwise it will be setTimeout(...,0)).
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=true]
 *  Specify invoking on the leading edge of the timeout.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new throttled function.
 * @example
 *
 * // Avoid excessively updating the position while scrolling.
 * const scrollHandler = useThrottledCallback(updatePosition, 100)
 * window.addEventListener('scroll', scrollHandler)
 *
 * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
 * const throttled = useThrottledCallback(renewToken, 300000, { 'trailing': false })
 * <button onClick={throttled}>click</button>
 *
 * // Cancel the trailing throttled invocation.
 * window.addEventListener('popstate', throttled.cancel);
 */
export default function useThrottledCallback<T extends (...args: any) => ReturnType<T>>(func: T, wait: number, { leading, trailing }?: CallOptions): DebouncedState<T>;
