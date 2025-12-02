import { isObject } from 'motion-utils';

/**
 * Checks if an element is an HTML element in a way
 * that works across iframes
 */
function isHTMLElement(element) {
    return isObject(element) && "offsetHeight" in element;
}

export { isHTMLElement };
