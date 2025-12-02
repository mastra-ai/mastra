import { pxValues } from '../../waapi/utils/px-values.mjs';

function applyPxDefaults(keyframes, name) {
    for (let i = 0; i < keyframes.length; i++) {
        if (typeof keyframes[i] === "number" && pxValues.has(name)) {
            keyframes[i] = keyframes[i] + "px";
        }
    }
}

export { applyPxDefaults };
