export function isAddedDelta(delta) {
    return Array.isArray(delta) && delta.length === 1;
}
export function isModifiedDelta(delta) {
    return Array.isArray(delta) && delta.length === 2;
}
export function isDeletedDelta(delta) {
    return (Array.isArray(delta) &&
        delta.length === 3 &&
        delta[1] === 0 &&
        delta[2] === 0);
}
export function isObjectDelta(delta) {
    return (delta !== undefined && typeof delta === "object" && !Array.isArray(delta));
}
export function isArrayDelta(delta) {
    return (delta !== undefined &&
        typeof delta === "object" &&
        "_t" in delta &&
        delta._t === "a");
}
export function isMovedDelta(delta) {
    return Array.isArray(delta) && delta.length === 3 && delta[2] === 3;
}
export function isTextDiffDelta(delta) {
    return Array.isArray(delta) && delta.length === 3 && delta[2] === 2;
}
