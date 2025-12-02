'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var react = require('react');
var motionDom = require('motion-dom');
var motionUtils = require('motion-utils');

/**
 * Creates a constant value over the lifecycle of a component.
 *
 * Even if `useMemo` is provided an empty array as its final argument, it doesn't offer
 * a guarantee that it won't re-run for performance reasons later on. By using `useConstant`
 * you can ensure that initialisers don't execute twice or more.
 */
function useConstant(init) {
    const ref = react.useRef(null);
    if (ref.current === null) {
        ref.current = init();
    }
    return ref.current;
}

function useUnmountEffect(callback) {
    return react.useEffect(() => () => callback(), []);
}

function animateElements(elementOrSelector, keyframes, options, scope) {
    const elements = motionDom.resolveElements(elementOrSelector, scope);
    const numElements = elements.length;
    motionUtils.invariant(Boolean(numElements), "No valid elements provided.", "no-valid-elements");
    /**
     * WAAPI doesn't support interrupting animations.
     *
     * Therefore, starting animations requires a three-step process:
     * 1. Stop existing animations (write styles to DOM)
     * 2. Resolve keyframes (read styles from DOM)
     * 3. Create new animations (write styles to DOM)
     *
     * The hybrid `animate()` function uses AsyncAnimation to resolve
     * keyframes before creating new animations, which removes style
     * thrashing. Here, we have much stricter filesize constraints.
     * Therefore we do this in a synchronous way that ensures that
     * at least within `animate()` calls there is no style thrashing.
     *
     * In the motion-native-animate-mini-interrupt benchmark this
     * was 80% faster than a single loop.
     */
    const animationDefinitions = [];
    /**
     * Step 1: Build options and stop existing animations (write)
     */
    for (let i = 0; i < numElements; i++) {
        const element = elements[i];
        const elementTransition = { ...options };
        /**
         * Resolve stagger function if provided.
         */
        if (typeof elementTransition.delay === "function") {
            elementTransition.delay = elementTransition.delay(i, numElements);
        }
        for (const valueName in keyframes) {
            let valueKeyframes = keyframes[valueName];
            if (!Array.isArray(valueKeyframes)) {
                valueKeyframes = [valueKeyframes];
            }
            const valueOptions = {
                ...motionDom.getValueTransition(elementTransition, valueName),
            };
            valueOptions.duration && (valueOptions.duration = motionUtils.secondsToMilliseconds(valueOptions.duration));
            valueOptions.delay && (valueOptions.delay = motionUtils.secondsToMilliseconds(valueOptions.delay));
            /**
             * If there's an existing animation playing on this element then stop it
             * before creating a new one.
             */
            const map = motionDom.getAnimationMap(element);
            const key = motionDom.animationMapKey(valueName, valueOptions.pseudoElement || "");
            const currentAnimation = map.get(key);
            currentAnimation && currentAnimation.stop();
            animationDefinitions.push({
                map,
                key,
                unresolvedKeyframes: valueKeyframes,
                options: {
                    ...valueOptions,
                    element,
                    name: valueName,
                    allowFlatten: !elementTransition.type && !elementTransition.ease,
                },
            });
        }
    }
    /**
     * Step 2: Resolve keyframes (read)
     */
    for (let i = 0; i < animationDefinitions.length; i++) {
        const { unresolvedKeyframes, options: animationOptions } = animationDefinitions[i];
        const { element, name, pseudoElement } = animationOptions;
        if (!pseudoElement && unresolvedKeyframes[0] === null) {
            unresolvedKeyframes[0] = motionDom.getComputedStyle(element, name);
        }
        motionDom.fillWildcards(unresolvedKeyframes);
        motionDom.applyPxDefaults(unresolvedKeyframes, name);
        /**
         * If we only have one keyframe, explicitly read the initial keyframe
         * from the computed style. This is to ensure consistency with WAAPI behaviour
         * for restarting animations, for instance .play() after finish, when it
         * has one vs two keyframes.
         */
        if (!pseudoElement && unresolvedKeyframes.length < 2) {
            unresolvedKeyframes.unshift(motionDom.getComputedStyle(element, name));
        }
        animationOptions.keyframes = unresolvedKeyframes;
    }
    /**
     * Step 3: Create new animations (write)
     */
    const animations = [];
    for (let i = 0; i < animationDefinitions.length; i++) {
        const { map, key, options: animationOptions } = animationDefinitions[i];
        const animation = new motionDom.NativeAnimation(animationOptions);
        map.set(key, animation);
        animation.finished.finally(() => map.delete(key));
        animations.push(animation);
    }
    return animations;
}

const createScopedWaapiAnimate = (scope) => {
    function scopedAnimate(elementOrSelector, keyframes, options) {
        return new motionDom.GroupAnimationWithThen(animateElements(elementOrSelector, keyframes, options, scope));
    }
    return scopedAnimate;
};

function useAnimateMini() {
    const scope = useConstant(() => ({
        current: null, // Will be hydrated by React
        animations: [],
    }));
    const animate = useConstant(() => createScopedWaapiAnimate(scope));
    useUnmountEffect(() => {
        scope.animations.forEach((animation) => animation.stop());
    });
    return [scope, animate];
}

exports.useAnimate = useAnimateMini;
