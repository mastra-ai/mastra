"use client";
import { motionValue } from 'motion-dom';
import { invariant } from 'motion-utils';
import { useRef, useCallback, useEffect } from 'react';
import { scroll } from '../render/dom/scroll/index.mjs';
import { useConstant } from '../utils/use-constant.mjs';
import { useIsomorphicLayoutEffect } from '../utils/use-isomorphic-effect.mjs';

const createScrollMotionValues = () => ({
    scrollX: motionValue(0),
    scrollY: motionValue(0),
    scrollXProgress: motionValue(0),
    scrollYProgress: motionValue(0),
});
const isRefPending = (ref) => {
    if (!ref)
        return false;
    return !ref.current;
};
function useScroll({ container, target, ...options } = {}) {
    const values = useConstant(createScrollMotionValues);
    const scrollAnimation = useRef(null);
    const needsStart = useRef(false);
    const start = useCallback(() => {
        scrollAnimation.current = scroll((_progress, { x, y, }) => {
            values.scrollX.set(x.current);
            values.scrollXProgress.set(x.progress);
            values.scrollY.set(y.current);
            values.scrollYProgress.set(y.progress);
        }, {
            ...options,
            container: container?.current || undefined,
            target: target?.current || undefined,
        });
        return () => {
            scrollAnimation.current?.();
        };
    }, [container, target, JSON.stringify(options.offset)]);
    useIsomorphicLayoutEffect(() => {
        needsStart.current = false;
        if (isRefPending(container) || isRefPending(target)) {
            needsStart.current = true;
            return;
        }
        else {
            return start();
        }
    }, [start]);
    useEffect(() => {
        if (needsStart.current) {
            invariant(!isRefPending(container), "Container ref is defined but not hydrated", "use-scroll-ref");
            invariant(!isRefPending(target), "Target ref is defined but not hydrated", "use-scroll-ref");
            return start();
        }
        else {
            return;
        }
    }, [start]);
    return values;
}

export { useScroll };
