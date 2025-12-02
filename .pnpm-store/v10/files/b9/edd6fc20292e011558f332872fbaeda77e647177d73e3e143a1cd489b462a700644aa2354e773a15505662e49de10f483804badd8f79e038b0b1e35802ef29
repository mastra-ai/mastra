import { MotionValue } from '../../value/index.mjs';
import { px } from '../../value/types/numbers/units.mjs';
import { addAttrValue } from '../attr/index.mjs';
import { addStyleValue } from '../style/index.mjs';
import { createSelectorEffect } from '../utils/create-dom-effect.mjs';
import { createEffect } from '../utils/create-effect.mjs';
import { frame } from '../../frameloop/frame.mjs';

const toPx = px.transform;
function addSVGPathValue(element, state, key, value) {
    frame.render(() => element.setAttribute("pathLength", "1"));
    if (key === "pathOffset") {
        return state.set(key, value, () => element.setAttribute("stroke-dashoffset", toPx(-state.latest[key])));
    }
    else {
        if (!state.get("stroke-dasharray")) {
            state.set("stroke-dasharray", new MotionValue("1 1"), () => {
                const { pathLength = 1, pathSpacing } = state.latest;
                element.setAttribute("stroke-dasharray", `${toPx(pathLength)} ${toPx(pathSpacing ?? 1 - Number(pathLength))}`);
            });
        }
        return state.set(key, value, undefined, state.get("stroke-dasharray"));
    }
}
const addSVGValue = (element, state, key, value) => {
    if (key.startsWith("path")) {
        return addSVGPathValue(element, state, key, value);
    }
    else if (key.startsWith("attr")) {
        return addAttrValue(element, state, convertAttrKey(key), value);
    }
    const handler = key in element.style ? addStyleValue : addAttrValue;
    return handler(element, state, key, value);
};
const svgEffect = /*@__PURE__*/ createSelectorEffect(
/*@__PURE__*/ createEffect(addSVGValue));
function convertAttrKey(key) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) => firstChar.toLowerCase());
}

export { svgEffect };
