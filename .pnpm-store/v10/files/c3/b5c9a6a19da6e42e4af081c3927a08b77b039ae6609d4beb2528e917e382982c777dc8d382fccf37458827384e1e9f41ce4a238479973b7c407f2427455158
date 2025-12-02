const animationMaps = new WeakMap();
const animationMapKey = (name, pseudoElement = "") => `${name}:${pseudoElement}`;
function getAnimationMap(element) {
    const map = animationMaps.get(element) || new Map();
    animationMaps.set(element, map);
    return map;
}

export { animationMapKey, getAnimationMap };
