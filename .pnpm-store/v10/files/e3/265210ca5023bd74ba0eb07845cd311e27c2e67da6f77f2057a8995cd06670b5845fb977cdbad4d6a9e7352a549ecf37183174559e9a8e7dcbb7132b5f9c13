import { isCSSVar } from './is-css-var.mjs';

function getComputedStyle(element, name) {
    const computedStyle = window.getComputedStyle(element);
    return isCSSVar(name)
        ? computedStyle.getPropertyValue(name)
        : computedStyle[name];
}

export { getComputedStyle };
