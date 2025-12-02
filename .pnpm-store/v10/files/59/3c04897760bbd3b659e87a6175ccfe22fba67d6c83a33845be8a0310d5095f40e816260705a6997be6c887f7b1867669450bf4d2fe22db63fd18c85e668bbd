import { transformProps, defaultTransformValue, readTransformValue, isCSSVariableName } from 'motion-dom';
import { measureViewportBox } from '../../projection/utils/measure.mjs';
import { DOMVisualElement } from '../dom/DOMVisualElement.mjs';
import { buildHTMLStyles } from './utils/build-styles.mjs';
import { renderHTML } from './utils/render.mjs';
import { scrapeMotionValuesFromProps } from './utils/scrape-motion-values.mjs';

function getComputedStyle(element) {
    return window.getComputedStyle(element);
}
class HTMLVisualElement extends DOMVisualElement {
    constructor() {
        super(...arguments);
        this.type = "html";
        this.renderInstance = renderHTML;
    }
    readValueFromInstance(instance, key) {
        if (transformProps.has(key)) {
            return this.projection?.isProjecting
                ? defaultTransformValue(key)
                : readTransformValue(instance, key);
        }
        else {
            const computedStyle = getComputedStyle(instance);
            const value = (isCSSVariableName(key)
                ? computedStyle.getPropertyValue(key)
                : computedStyle[key]) || 0;
            return typeof value === "string" ? value.trim() : value;
        }
    }
    measureInstanceViewportBox(instance, { transformPagePoint }) {
        return measureViewportBox(instance, transformPagePoint);
    }
    build(renderState, latestValues, props) {
        buildHTMLStyles(renderState, latestValues, props.transformTemplate);
    }
    scrapeMotionValuesFromProps(props, prevProps, visualElement) {
        return scrapeMotionValuesFromProps(props, prevProps, visualElement);
    }
}

export { HTMLVisualElement, getComputedStyle };
