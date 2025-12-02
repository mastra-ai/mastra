import { camelToDash } from '../../render/dom/utils/camel-to-dash.mjs';
import { createSelectorEffect } from '../utils/create-dom-effect.mjs';
import { createEffect } from '../utils/create-effect.mjs';

function canSetAsProperty(element, name) {
    if (!(name in element))
        return false;
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), name) ||
        Object.getOwnPropertyDescriptor(element, name);
    // Check if it has a setter
    return descriptor && typeof descriptor.set === "function";
}
const addAttrValue = (element, state, key, value) => {
    const isProp = canSetAsProperty(element, key);
    const name = isProp
        ? key
        : key.startsWith("data") || key.startsWith("aria")
            ? camelToDash(key)
            : key;
    /**
     * Set attribute directly via property if available
     */
    const render = isProp
        ? () => {
            element[name] = state.latest[key];
        }
        : () => {
            const v = state.latest[key];
            if (v === null || v === undefined) {
                element.removeAttribute(name);
            }
            else {
                element.setAttribute(name, String(v));
            }
        };
    return state.set(key, value, render);
};
const attrEffect = /*@__PURE__*/ createSelectorEffect(
/*@__PURE__*/ createEffect(addAttrValue));

export { addAttrValue, attrEffect };
