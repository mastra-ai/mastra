import { wrap } from '../../wrap.mjs';
import { isEasingArray } from './is-easing-array.mjs';

function getEasingForSegment(easing, i) {
    return isEasingArray(easing) ? easing[wrap(0, easing.length, i)] : easing;
}

export { getEasingForSegment };
