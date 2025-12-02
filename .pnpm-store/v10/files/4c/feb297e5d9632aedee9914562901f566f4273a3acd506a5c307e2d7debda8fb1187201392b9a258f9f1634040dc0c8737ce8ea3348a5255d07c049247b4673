import { isMotionValue } from 'motion-dom';
import { isForcedMotionValue } from '../../../motion/utils/is-forced-motion-value.mjs';

function scrapeMotionValuesFromProps(props, prevProps, visualElement) {
    const { style } = props;
    const newValues = {};
    for (const key in style) {
        if (isMotionValue(style[key]) ||
            (prevProps.style &&
                isMotionValue(prevProps.style[key])) ||
            isForcedMotionValue(key, props) ||
            visualElement?.getValue(key)?.liveStyle !== undefined) {
            newValues[key] = style[key];
        }
    }
    return newValues;
}

export { scrapeMotionValuesFromProps };
