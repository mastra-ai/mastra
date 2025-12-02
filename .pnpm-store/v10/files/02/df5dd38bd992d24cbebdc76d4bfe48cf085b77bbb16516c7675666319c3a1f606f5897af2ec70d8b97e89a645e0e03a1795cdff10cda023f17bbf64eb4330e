import { inertia } from '../generators/inertia.mjs';
import { keyframes } from '../generators/keyframes.mjs';
import { spring } from '../generators/spring/index.mjs';

const transitionTypeMap = {
    decay: inertia,
    inertia,
    tween: keyframes,
    keyframes: keyframes,
    spring,
};
function replaceTransitionType(transition) {
    if (typeof transition.type === "string") {
        transition.type = transitionTypeMap[transition.type];
    }
}

export { replaceTransitionType };
