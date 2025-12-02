import { noop } from 'motion-utils';
import { attachToAnimation } from './attach-animation.mjs';
import { attachToFunction } from './attach-function.mjs';

function scroll(onScroll, { axis = "y", container = document.scrollingElement, ...options } = {}) {
    if (!container)
        return noop;
    const optionsWithDefaults = { axis, container, ...options };
    return typeof onScroll === "function"
        ? attachToFunction(onScroll, optionsWithDefaults)
        : attachToAnimation(onScroll, optionsWithDefaults);
}

export { scroll };
