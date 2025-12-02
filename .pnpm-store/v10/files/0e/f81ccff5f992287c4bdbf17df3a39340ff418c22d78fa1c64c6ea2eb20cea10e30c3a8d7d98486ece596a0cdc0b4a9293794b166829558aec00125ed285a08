import { isBezierDefinition } from 'motion-utils';
import { supportsLinearEasing } from '../../../utils/supports/linear-easing.mjs';
import { generateLinearEasing } from '../utils/linear.mjs';
import { cubicBezierAsString } from './cubic-bezier.mjs';
import { supportedWaapiEasing } from './supported.mjs';

function mapEasingToNativeEasing(easing, duration) {
    if (!easing) {
        return undefined;
    }
    else if (typeof easing === "function") {
        return supportsLinearEasing()
            ? generateLinearEasing(easing, duration)
            : "ease-out";
    }
    else if (isBezierDefinition(easing)) {
        return cubicBezierAsString(easing);
    }
    else if (Array.isArray(easing)) {
        return easing.map((segmentEasing) => mapEasingToNativeEasing(segmentEasing, duration) ||
            supportedWaapiEasing.easeOut);
    }
    else {
        return supportedWaapiEasing[easing];
    }
}

export { mapEasingToNativeEasing };
