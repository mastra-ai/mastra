import { isBezierDefinition } from 'motion-utils';
import { supportsLinearEasing } from '../../../utils/supports/linear-easing.mjs';
import { supportedWaapiEasing } from './supported.mjs';

function isWaapiSupportedEasing(easing) {
    return Boolean((typeof easing === "function" && supportsLinearEasing()) ||
        !easing ||
        (typeof easing === "string" &&
            (easing in supportedWaapiEasing || supportsLinearEasing())) ||
        isBezierDefinition(easing) ||
        (Array.isArray(easing) && easing.every(isWaapiSupportedEasing)));
}

export { isWaapiSupportedEasing };
