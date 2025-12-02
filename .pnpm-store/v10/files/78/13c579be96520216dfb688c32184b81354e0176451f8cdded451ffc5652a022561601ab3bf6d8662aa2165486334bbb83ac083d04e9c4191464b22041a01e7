import { warnOnce } from 'motion-utils';
import { createMotionComponent } from '../../motion/index.mjs';

function createMotionProxy(preloadedFeatures, createVisualElement) {
    if (typeof Proxy === "undefined") {
        return createMotionComponent;
    }
    /**
     * A cache of generated `motion` components, e.g `motion.div`, `motion.input` etc.
     * Rather than generating them anew every render.
     */
    const componentCache = new Map();
    const factory = (Component, options) => {
        return createMotionComponent(Component, options, preloadedFeatures, createVisualElement);
    };
    /**
     * Support for deprecated`motion(Component)` pattern
     */
    const deprecatedFactoryFunction = (Component, options) => {
        if (process.env.NODE_ENV !== "production") {
            warnOnce(false, "motion() is deprecated. Use motion.create() instead.");
        }
        return factory(Component, options);
    };
    return new Proxy(deprecatedFactoryFunction, {
        /**
         * Called when `motion` is referenced with a prop: `motion.div`, `motion.input` etc.
         * The prop name is passed through as `key` and we can use that to generate a `motion`
         * DOM component with that name.
         */
        get: (_target, key) => {
            if (key === "create")
                return factory;
            /**
             * If this element doesn't exist in the component cache, create it and cache.
             */
            if (!componentCache.has(key)) {
                componentCache.set(key, createMotionComponent(key, undefined, preloadedFeatures, createVisualElement));
            }
            return componentCache.get(key);
        },
    });
}

export { createMotionProxy };
