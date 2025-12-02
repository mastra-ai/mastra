import { GroupAnimationWithThen } from 'motion-dom';
import { removeItem } from 'motion-utils';
import { animateSequence } from './sequence.mjs';
import { animateSubject } from './subject.mjs';

function isSequence(value) {
    return Array.isArray(value) && value.some(Array.isArray);
}
/**
 * Creates an animation function that is optionally scoped
 * to a specific element.
 */
function createScopedAnimate(scope) {
    /**
     * Implementation
     */
    function scopedAnimate(subjectOrSequence, optionsOrKeyframes, options) {
        let animations = [];
        let animationOnComplete;
        if (isSequence(subjectOrSequence)) {
            animations = animateSequence(subjectOrSequence, optionsOrKeyframes, scope);
        }
        else {
            // Extract top-level onComplete so it doesn't get applied per-value
            const { onComplete, ...rest } = options || {};
            if (typeof onComplete === "function") {
                animationOnComplete = onComplete;
            }
            animations = animateSubject(subjectOrSequence, optionsOrKeyframes, rest, scope);
        }
        const animation = new GroupAnimationWithThen(animations);
        if (animationOnComplete) {
            animation.finished.then(animationOnComplete);
        }
        if (scope) {
            scope.animations.push(animation);
            animation.finished.then(() => {
                removeItem(scope.animations, animation);
            });
        }
        return animation;
    }
    return scopedAnimate;
}
const animate = createScopedAnimate();

export { animate, createScopedAnimate };
