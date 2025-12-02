import { collectMotionValues, motionValue } from './index.mjs';
import { subscribeValue } from './subscribe-value.mjs';

/**
 * Create a `MotionValue` that transforms the output of other `MotionValue`s by
 * passing their latest values through a transform function.
 *
 * Whenever a `MotionValue` referred to in the provided function is updated,
 * it will be re-evaluated.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = transformValue(() => x.get() * 2) // double x
 * ```
 *
 * @param transformer - A transform function. This function must be pure with no side-effects or conditional statements.
 * @returns `MotionValue`
 *
 * @public
 */
function transformValue(transform) {
    const collectedValues = [];
    /**
     * Open session of collectMotionValues. Any MotionValue that calls get()
     * inside transform will be saved into this array.
     */
    collectMotionValues.current = collectedValues;
    const initialValue = transform();
    collectMotionValues.current = undefined;
    const value = motionValue(initialValue);
    subscribeValue(collectedValues, value, transform);
    return value;
}

export { transformValue };
