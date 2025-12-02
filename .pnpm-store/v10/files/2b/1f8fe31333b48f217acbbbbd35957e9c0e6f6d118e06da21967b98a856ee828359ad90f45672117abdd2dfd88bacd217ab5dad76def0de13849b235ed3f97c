import { isSVGElement } from './is-svg-element.mjs';

/**
 * Checks if an element is specifically an SVGSVGElement (the root SVG element)
 * in a way that works across iframes
 */
function isSVGSVGElement(element) {
    return isSVGElement(element) && element.tagName === "svg";
}

export { isSVGSVGElement };
