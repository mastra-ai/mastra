import { transformProps } from 'motion-dom';
import { scaleCorrectors } from '../../projection/styles/scale-correction.mjs';

function isForcedMotionValue(key, { layout, layoutId }) {
    return (transformProps.has(key) ||
        key.startsWith("origin") ||
        ((layout || layoutId !== undefined) &&
            (!!scaleCorrectors[key] || key === "opacity")));
}

export { isForcedMotionValue };
